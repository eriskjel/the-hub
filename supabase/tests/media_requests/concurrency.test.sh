#!/usr/bin/env bash
# Sourced by run.sh against its throwaway database. Each pair waits for a real
# lock conflict before allowing the first transaction to finish.
set -euo pipefail

requester="00000000-0000-0000-0000-0000000000f1"
follower="00000000-0000-0000-0000-0000000000f2"
as_admin -c "insert into auth.users (id) values ('$follower');
    insert into public.media_member (user_id, library_account) values
        ('$requester', 'parallel_requester'), ('$follower', 'parallel_follower');
    create table public.request_test_gate (name text primary key, released boolean not null);
    grant select on public.request_test_gate to service_role;" </dev/null

wait_for_activity() {
    local app="$1" condition="$2"
    for _ in $(seq 1 100); do
        if [ "$(as_admin -tA -c "select exists (
            select 1 from pg_stat_activity where application_name = '$app' and $condition
        )" </dev/null)" = "t" ]; then
            return
        fi
        sleep 0.05
    done
    echo "did not observe $app: $condition" >&2
    return 1
}

run_pair() (
    local label="$1" first_sql="$2" second_sql="$3" expected_first="$4" expected_second="$5"
    local first_out second_out first_pid second_pid first_result second_result
    first_out="$(mktemp)"
    second_out="$(mktemp)"
    trap 'rm -f "$first_out" "$second_out"' EXIT
    as_admin -c "insert into public.request_test_gate values ('$label', false)" </dev/null
    as_admin -tA -c "set application_name = '$label-first'; begin; set local role service_role;
        $first_sql; set local role service_role;
        do \$\$ declare deadline timestamptz := clock_timestamp() + interval '15 seconds'; begin
            while not (select released from public.request_test_gate where name = '$label') loop
                if clock_timestamp() >= deadline then raise exception 'test gate timed out'; end if;
                perform pg_sleep(0.05);
            end loop;
        end \$\$; commit;" </dev/null >"$first_out" &
    first_pid=$!
    wait_for_activity "$label-first" "wait_event = 'PgSleep'"
    as_admin -tA -c "set application_name = '$label-second'; set role service_role;
        $second_sql;" </dev/null >"$second_out" &
    second_pid=$!
    wait_for_activity "$label-second" "wait_event_type = 'Lock'"
    as_admin -c "update public.request_test_gate set released = true where name = '$label'" </dev/null
    wait "$first_pid"
    wait "$second_pid"
    first_result="$(grep -E '^[a-z_]+$' "$first_out" | head -1)"
    second_result="$(grep -E '^[a-z_]+$' "$second_out" | head -1)"
    if [ "$first_result" != "$expected_first" ] || [ "$second_result" != "$expected_second" ]; then
        echo "$label: expected $expected_first + $expected_second, got $first_result + $second_result" >&2
        return 1
    fi
    echo "== $label: $first_result + $second_result"
)

seed_request() {
    local title="$1"
    as_admin -tA -c "insert into public.media_request (media_type, tmdb_id, requested_by)
        values ('movie', $title, '$requester') returning id" </dev/null
}

assert_state() {
    local rid="$1" status="$2" owner="$3" followers="$4"
    as_admin -c "do \$\$ begin
        assert (select status = '$status' and requested_by = '$owner'
                  from public.media_request where id = $rid), 'unexpected request state';
        assert (select count(*) from public.media_request_follower where request_id = $rid) = $followers,
            'unexpected follower count';
    end \$\$;" </dev/null
}

rid="$(seed_request 910001)"
as_admin -c "insert into public.media_request_follower values ($rid, '$follower', now())" </dev/null
run_pair withdraw-first \
    "select public.media_request_unfollow('$follower', $rid)" \
    "select public.media_request_cancel('$requester', $rid)" unfollowed cancelled
assert_state "$rid" cancelled "$requester" 0

rid="$(seed_request 910002)"
as_admin -c "insert into public.media_request_follower values ($rid, '$follower', now())" </dev/null
run_pair handover-first \
    "select public.media_request_cancel('$requester', $rid)" \
    "select public.media_request_unfollow('$follower', $rid)" handed_over changed
assert_state "$rid" wanted "$follower" 0

rid="$(seed_request 910003)"
run_pair close-first \
    "update public.media_request set status = 'available' where id = $rid returning status" \
    "select public.media_request_add('$follower', 'movie', 910003, 0)" available available
assert_state "$rid" available "$requester" 0

rid="$(seed_request 910004)"
run_pair follow-first \
    "select public.media_request_add('$follower', 'movie', 910004, 0)" \
    "update public.media_request set status = 'available' where id = $rid returning status" followed available
assert_state "$rid" available "$requester" 1

rid="$(seed_request 910006)"
run_pair cancel-first \
    "select public.media_request_cancel('$requester', $rid)" \
    "select public.media_request_add('$follower', 'movie', 910006, 0)" cancelled quota_exceeded
assert_state "$rid" cancelled "$requester" 0

rid="$(seed_request 910007)"
run_pair follow-before-cancel \
    "select public.media_request_add('$follower', 'movie', 910007, 0)" \
    "select public.media_request_cancel('$requester', $rid)" followed handed_over
assert_state "$rid" wanted "$follower" 0

run_pair same-title \
    "select public.media_request_add('$requester', 'movie', 910005, null)" \
    "select public.media_request_add('$follower', 'movie', 910005, 0)" requested followed
rid="$(as_admin -tA -c 'select id from public.media_request where tmdb_id = 910005' </dev/null)"
assert_state "$rid" wanted "$requester" 1

# A removal the worker has started wins over a Keep that comes in meanwhile.
rid="$(seed_request 910008)"
as_admin -c "update public.media_request set status = 'available', remove_after_days = 30, remove_at = now()
    where id = $rid" </dev/null
run_pair remove-before-keep \
    "update public.media_request set status = 'removed' where id = $rid returning status" \
    "select public.media_request_keep('$requester', $rid)" removed changed
assert_state "$rid" removed "$requester" 0

echo '== all request transition concurrency tests passed'
