\set ON_ERROR_STOP 1
\set QUIET 1

\echo '== worker access: only the worker may ask whether a request is still wanted'
do $$ begin
    assert has_function_privilege('media_worker', 'public.media_request_still_wanted(bigint)', 'EXECUTE'),
        'the worker can ask';
    assert not has_function_privilege('anon', 'public.media_request_still_wanted(bigint)', 'EXECUTE'),
        'anon cannot ask';
    assert not has_function_privilege('authenticated', 'public.media_request_still_wanted(bigint)', 'EXECUTE'),
        'signed-in users cannot ask';
    assert not has_function_privilege('media_worker', 'public.media_request_has_access(uuid)', 'EXECUTE'),
        'the worker cannot look up access for any user';
end $$;

\echo '== worker access: the requester or a follower must still have access'
begin;
insert into auth.users (id, raw_app_meta_data) values
    ('00000000-0000-0000-0000-0000000000a3', '{}'),                   -- member
    ('00000000-0000-0000-0000-0000000000b3', '{}'),                   -- revoked member
    ('00000000-0000-0000-0000-0000000000c3', '{"roles":["admin"]}'),  -- admin, no membership row
    ('00000000-0000-0000-0000-0000000000d3', '{}');                   -- never granted
insert into public.media_member (user_id, library_account, revoked_at) values
    ('00000000-0000-0000-0000-0000000000a3', 'worker-access-member', null),
    ('00000000-0000-0000-0000-0000000000b3', 'worker-access-revoked', now());
insert into public.media_request (media_type, tmdb_id, requested_by) values
    ('movie', 940001, '00000000-0000-0000-0000-0000000000a3'),
    ('movie', 940002, '00000000-0000-0000-0000-0000000000b3'),
    ('movie', 940003, '00000000-0000-0000-0000-0000000000b3'),
    ('movie', 940004, null),
    ('movie', 940005, '00000000-0000-0000-0000-0000000000c3'),
    ('movie', 940006, '00000000-0000-0000-0000-0000000000d3');
insert into public.media_request_follower (request_id, user_id)
    select id, '00000000-0000-0000-0000-0000000000a3'::uuid from public.media_request where tmdb_id = 940003
    union all
    select id, '00000000-0000-0000-0000-0000000000c3'::uuid from public.media_request where tmdb_id = 940004
    union all
    select id, '00000000-0000-0000-0000-0000000000b3'::uuid from public.media_request where tmdb_id = 940006;

-- Runs with the caller's rights, so the checks below run as the worker.
create function pg_temp.wanted(p_tmdb_id int) returns boolean language sql as $$
    select public.media_request_still_wanted(id) from public.media_request where tmdb_id = p_tmdb_id
$$;
set local role media_worker;
do $$ begin
    assert pg_temp.wanted(940001), 'a member''s request is wanted';
    assert not pg_temp.wanted(940002), 'a revoked requester alone is not enough';
    assert pg_temp.wanted(940003), 'a member''s +1 keeps a revoked requester''s request';
    assert pg_temp.wanted(940004), 'an admin''s +1 counts without a membership row';
    assert pg_temp.wanted(940005), 'an admin''s own request counts without a membership row';
    assert not pg_temp.wanted(940006), 'a revoked +1 does not count';
    assert not public.media_request_still_wanted(-1), 'a missing request is not wanted';
end $$;
rollback;
\echo '== all worker access tests passed'
