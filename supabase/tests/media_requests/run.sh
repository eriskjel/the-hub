#!/usr/bin/env bash
# Applies every migration to a throwaway Supabase Postgres and runs the media
# request RLS/privilege tests. Needs Docker. Usage: supabase/tests/media_requests/run.sh
# MIGRATION=<file> swaps in a different media migration (used to check that the
# tests catch a broken one).
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
for file in "$root"/supabase/migrations/*media_request*.sql; do
    if [ "$(basename "$file")" = "20261007000000_media_requests.sql" ]; then
        file="$migration"
    fi
    as_postgres < "$file"
done
as_admin < "$here/rls.test.sql"
