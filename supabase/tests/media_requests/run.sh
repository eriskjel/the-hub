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

for _ in $(seq 1 60); do
    docker exec "$name" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
    sleep 2
done
sleep 3 # the image runs init scripts after the first ready signal

# Migrations run as postgres (not a superuser), as on the hosted project.
as_postgres() { docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -h localhost -d postgres; }
as_admin() { docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres; }

echo "== migrations"
for file in "$root"/supabase/migrations/*.sql; do
    if [ "$(basename "$file")" = "20261007000000_media_requests.sql" ]; then
        file="$migration"
    fi
    as_postgres < "$file"
done
echo "== media migration again, to check it is idempotent"
as_postgres < "$migration"
as_admin < "$here/rls.test.sql"
