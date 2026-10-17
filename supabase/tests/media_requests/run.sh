#!/usr/bin/env bash
# Applies every migration to a throwaway Supabase Postgres and runs the media
# request RLS/privilege tests. Needs Docker. Usage: supabase/tests/media_requests/run.sh
# MIGRATION=<file> swaps in a different media migration (used to check that the
# tests catch a broken one).
# Function mutations run AFTER all migrations (including the idempotency pass),
# so a later CREATE OR REPLACE cannot silently repair the deliberately broken function.
# TRANSITION_MIGRATION / ADMIN_QUEUE_MIGRATION / WORKER_ACCESS_MIGRATION retain
# their existing names but now apply their SQL last. Prefer small function overrides
# rather than copies of historical migrations. FUNCTION_OVERRIDES accepts other overrides.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
migration="${MIGRATION:-$root/supabase/migrations/20261007000000_media_requests.sql}"
image="supabase/postgres:17.11.0.004"
name="hub-media-rls-test"

docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=localtest "$image" >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

# Migrations run as postgres (not a superuser), as on the hosted project.
as_postgres() { docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -h localhost -d postgres "$@"; }
as_admin() { docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres "$@"; }

# Wait until the image's init has created what the migrations depend on, not
# just until the server accepts connections.
ready_sql="select count(*) = 3 and to_regprocedure('auth.uid()') is not null
           from pg_roles where rolname in ('anon', 'authenticated', 'service_role')"
ready=""
for _ in $(seq 1 90); do
    if [ "$(as_postgres -tA -c "$ready_sql" </dev/null 2>/dev/null)" = "t" ]; then
        ready=1
        break
    fi
    sleep 2
done
if [ -z "$ready" ]; then
    echo "database did not become ready within 180s" >&2
    docker logs "$name" 2>&1 | tail -20 >&2
    exit 1
fi

echo "== migrations"
for file in "$root"/supabase/migrations/*.sql; do
    if [ "$(basename "$file")" = "20261007000000_media_requests.sql" ]; then
        file="$migration"
    fi
    as_postgres < "$file"
done
echo "== media migrations again, to check they are idempotent"
for file in "$root"/supabase/migrations/*media_*.sql; do
    if [ "$(basename "$file")" = "20261007000000_media_requests.sql" ]; then
        file="$migration"
    fi
    as_postgres < "$file"
done
# All function overrides must be last, regardless of which migration defined them.
for override in "${TRANSITION_MIGRATION:-}" "${ADMIN_QUEUE_MIGRATION:-}" "${WORKER_ACCESS_MIGRATION:-}" "${FUNCTION_OVERRIDES:-}"; do
    if [ -n "$override" ]; then
        echo "== applying function override: $override"
        as_postgres < "$override"
    fi
done
as_admin < "$here/rls.test.sql"
as_admin < "$here/admin_queue.test.sql"
as_admin < "$here/worker_access.test.sql"
as_admin < "$here/detail_codes.test.sql"
as_admin < "$here/notes.test.sql"

# Two calls for the same user at the same time: the second must wait for the
# first and count it. Without the lock both would see 0 and pass a quota of 1.
echo "== media_request_add: parallel calls stay within the quota"
user="00000000-0000-0000-0000-0000000000f1"
as_admin -c "insert into auth.users (id) values ('$user')" </dev/null
first_out="$(mktemp)"
as_admin -tA </dev/null >"$first_out" -c "begin;
    set local role service_role;
    select public.media_request_add('$user', 'movie', 900001, 1);
    select pg_sleep(3);
    commit;" &
first=$!
sleep 1
second="$(as_admin -tA </dev/null -c "set role service_role;
    select public.media_request_add('$user', 'movie', 900002, 1)")"
wait "$first"
first_result="$(grep -E '^[a-z_]+$' "$first_out" | head -1)"
rm -f "$first_out"
if [ "$first_result" != "requested" ] || [ "$second" != "quota_exceeded" ]; then
    echo "parallel calls: expected requested + quota_exceeded, got '$first_result' + '$second'" >&2
    exit 1
fi
echo "== all media_request_add tests passed"

source "$here/concurrency.test.sh"
source "$here/admin_concurrency.test.sh"
