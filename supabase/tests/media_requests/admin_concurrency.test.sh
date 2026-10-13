#!/usr/bin/env bash
# Sourced after concurrency.test.sh to reuse its transaction gates and fixtures.
set -euo pipefail

rid="$(seed_request 930001)"
revision="$(as_admin -tA -c "select updated_at from public.media_request where id = $rid" </dev/null)"
run_pair worker-before-admin \
    "update public.media_request set status = 'searching', claimed_at = now() where id = $rid returning status" \
    "select public.media_request_admin_update($rid, 'decline', '$revision')" searching changed
assert_state "$rid" searching "$requester" 0

rid="$(seed_request 930002)"
revision="$(as_admin -tA -c "select updated_at from public.media_request where id = $rid" </dev/null)"
run_pair admin-before-worker \
    "select public.media_request_admin_update($rid, 'decline', '$revision')" \
    "with claimed as (update public.media_request set status = 'searching', claimed_at = now()
         where id = $rid and status = 'wanted' returning id)
     select case when exists (select 1 from claimed) then 'searching' else 'skipped' end" declined skipped
assert_state "$rid" declined "$requester" 0

rid="$(seed_request 930003)"
revision="$(as_admin -tA -c "select updated_at from public.media_request where id = $rid" </dev/null)"
run_pair competing-admins \
    "select public.media_request_admin_update($rid, 'decline', '$revision')" \
    "select public.media_request_admin_update($rid, 'available', '$revision')" declined changed
assert_state "$rid" declined "$requester" 0

as_admin -c 'update public.media_worker_status set paused = false where id' </dev/null
run_pair pause-before-heartbeat \
    "select public.media_worker_set_paused(true, false)" \
    "set role media_worker; update public.media_worker_status
       set mode = 'auto', last_run_at = now(), detail = 'Updated' where id returning mode" paused auto
as_admin -c "do \$\$ begin assert (select paused and mode = 'auto' and detail = 'Updated'
    from public.media_worker_status where id), 'heartbeat preserves pause'; end \$\$;" </dev/null

as_admin -c 'update public.media_worker_status set paused = false where id' </dev/null
run_pair heartbeat-before-pause \
    "set role media_worker; update public.media_worker_status
       set mode = 'review', last_run_at = now(), detail = 'Latest update' where id returning mode" \
    "select public.media_worker_set_paused(true, false)" review paused
as_admin -c "do \$\$ begin assert (select paused and mode = 'review' and detail = 'Latest update'
    from public.media_worker_status where id), 'pause preserves heartbeat'; end \$\$;" </dev/null

echo '== all admin queue concurrency tests passed'
