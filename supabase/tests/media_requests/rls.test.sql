-- RLS and privilege tests for the media request tables.
-- Runs as a superuser and switches role per section, the way PostgREST does
-- (SET ROLE + request.jwt.claim.sub). Any failed assertion stops the run.
--
-- Users:
--   ...a1 admin   (member, no library account)
--   ...b1 alice   (member)
--   ...c1 bob     (member)
--   ...d1 dave    (revoked)
--   ...e1 eve     (signed in, never granted)

\set ON_ERROR_STOP 1
\set QUIET 1

\echo '== seed'
insert into auth.users (id) values
    ('00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-0000000000b1'),
    ('00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-0000000000d1'),
    ('00000000-0000-0000-0000-0000000000e1');
-- The sign-up trigger from the baseline creates the matching profiles rows.

insert into public.media_member (user_id, library_account, granted_by, revoked_at) values
    ('00000000-0000-0000-0000-0000000000a1', null,    null, null),
    ('00000000-0000-0000-0000-0000000000b1', 'alice', '00000000-0000-0000-0000-0000000000a1', null),
    ('00000000-0000-0000-0000-0000000000c1', 'bob',   '00000000-0000-0000-0000-0000000000a1', null),
    ('00000000-0000-0000-0000-0000000000d1', 'dave',  '00000000-0000-0000-0000-0000000000a1', now());

insert into public.media_request (media_type, tmdb_id, requested_by) values
    ('movie', 157336, '00000000-0000-0000-0000-0000000000b1'),
    ('movie', 27205,  '00000000-0000-0000-0000-0000000000c1');
insert into public.media_request_follower (request_id, user_id)
    select id, '00000000-0000-0000-0000-0000000000c1' from public.media_request where tmdb_id = 157336;
insert into public.media_request_option (request_id, rank, label)
    select id, 1, 'Option one' from public.media_request where tmdb_id = 157336;

-- ---------------------------------------------------------------------------
\echo '== structure: RLS on, no user write policies, no user write grants'
do $$
declare
    t text;
    p text;
begin
    foreach t in array array['media_member', 'media_request', 'media_request_follower',
                             'media_request_option', 'media_worker_status'] loop
        assert (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass),
            format('RLS must be enabled on %s', t);
        foreach p in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
            assert not has_table_privilege('authenticated', 'public.' || t, p),
                format('authenticated must not have %s on %s', p, t);
            assert not has_table_privilege('anon', 'public.' || t, p),
                format('anon must not have %s on %s', p, t);
        end loop;
        assert not has_table_privilege('anon', 'public.' || t, 'SELECT'),
            format('anon must not have SELECT on %s', t);
    end loop;

    assert not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename like 'media\_%'
          and cmd <> 'SELECT'
          and (roles && array['authenticated', 'anon', 'public']::name[])
    ), 'no write policy may target authenticated, anon or public';

    assert not has_sequence_privilege('authenticated', 'public.media_request_id_seq', 'USAGE'),
        'authenticated must not use the request id sequence';
    assert not has_function_privilege('anon', 'public.is_media_member()', 'EXECUTE'),
        'anon must not execute is_media_member';
end $$;

-- ---------------------------------------------------------------------------
\echo '== anon: no access at all'
set role anon;
do $$ begin
    perform 1 from public.media_request;
    raise exception 'FAIL: anon read media_request';
exception when insufficient_privilege then null; end $$;
do $$ begin
    perform 1 from public.media_member;
    raise exception 'FAIL: anon read media_member';
exception when insufficient_privilege then null; end $$;
do $$ begin
    perform 1 from public.media_worker_status;
    raise exception 'FAIL: anon read media_worker_status';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '== eve (signed in, not a member): sees nothing, can write nothing'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
    assert (select count(*) from public.media_request) = 0, 'non-member must see no requests';
    assert (select count(*) from public.media_request_follower) = 0, 'non-member must see no followers';
    assert (select count(*) from public.media_worker_status) = 0, 'non-member must not see worker status';
    assert (select count(*) from public.media_member) = 0, 'non-member must see no member rows';
    assert not public.is_media_member(), 'non-member is not a member';
end $$;
do $$ begin
    insert into public.media_member (user_id, library_account)
        values ('00000000-0000-0000-0000-0000000000e1', 'eve');
    raise exception 'FAIL: non-member granted themselves membership';
exception when insufficient_privilege then null; end $$;
do $$ begin
    insert into public.media_request (media_type, tmdb_id, requested_by)
        values ('movie', 603, '00000000-0000-0000-0000-0000000000e1');
    raise exception 'FAIL: non-member inserted a request';
exception when insufficient_privilege then null; end $$;
do $$ begin
    perform 1 from public.media_request_option;
    raise exception 'FAIL: non-member read options';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '== dave (revoked): sees own membership row only'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$ begin
    assert (select count(*) from public.media_request) = 0, 'revoked member must see no requests';
    assert (select count(*) from public.media_member) = 1, 'revoked member sees own row';
    assert not public.is_media_member(), 'revoked member is not a member';
end $$;
do $$ begin
    update public.media_member set revoked_at = null
        where user_id = '00000000-0000-0000-0000-0000000000d1';
    raise exception 'FAIL: revoked member reinstated themselves';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '== alice (member): reads the shared queue, writes nothing'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
do $$ begin
    assert public.is_media_member(), 'alice is a member';
    assert (select count(*) from public.media_request) = 2, 'member sees the whole shared queue';
    assert (select count(*) from public.media_request_follower) = 1, 'member sees followers';
    assert (select count(*) from public.media_worker_status) = 1, 'member sees worker status';
    assert (select count(*) from public.media_member) = 1, 'member sees only own membership';
    assert (select library_account from public.media_member) = 'alice', 'and it is hers';
end $$;
do $$ begin
    insert into public.media_request (media_type, tmdb_id, requested_by)
        values ('movie', 603, '00000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL: member inserted directly (bypasses quota)';
exception when insufficient_privilege then null; end $$;
do $$ begin
    update public.media_request set status = 'available';
    raise exception 'FAIL: member changed a status';
exception when insufficient_privilege then null; end $$;
do $$ begin
    delete from public.media_request;
    raise exception 'FAIL: member deleted requests';
exception when insufficient_privilege then null; end $$;
do $$ begin
    insert into public.media_request_follower (request_id, user_id)
        select id, '00000000-0000-0000-0000-0000000000b1' from public.media_request where tmdb_id = 27205;
    raise exception 'FAIL: member followed directly';
exception when insufficient_privilege then null; end $$;
do $$ begin
    update public.media_member set weekly_quota = 50;
    raise exception 'FAIL: member raised own quota';
exception when insufficient_privilege then null; end $$;
do $$ begin
    insert into public.media_member (user_id, library_account)
        values ('00000000-0000-0000-0000-0000000000e1', 'eve');
    raise exception 'FAIL: member granted someone else membership';
exception when insufficient_privilege then null; end $$;
do $$ begin
    perform 1 from public.media_request_option;
    raise exception 'FAIL: member read options';
exception when insufficient_privilege then null; end $$;
do $$ begin
    update public.media_worker_status set paused = false;
    raise exception 'FAIL: member flipped the kill switch';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '== media_worker: status columns only'
set role media_worker;
do $$ begin
    assert (select count(*) from public.media_request) = 2, 'worker reads the queue';
    assert (select count(*) from public.media_request_follower) = 1, 'worker reads followers';
    assert (select count(*) from public.media_member where revoked_at is null) = 3,
        'worker reads membership state';
end $$;

-- Claim the next due request, the way the worker will.
do $$
declare
    claimed bigint;
begin
    update public.media_request
       set status = 'searching', claimed_at = now(), attempts = attempts + 1
     where id = (select id from public.media_request
                  where status = 'wanted' and next_check_at <= now()
                  order by created_at
                  limit 1
                  for update skip locked)
    returning id into claimed;
    assert claimed is not null, 'worker can claim a due request';
end $$;

do $$ begin
    update public.media_request set tmdb_id = 999999 where tmdb_id = 27205;
    raise exception 'FAIL: worker changed which title a request is for';
exception when insufficient_privilege then null; end $$;
do $$ begin
    update public.media_request set requested_by = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FAIL: worker changed a requester';
exception when insufficient_privilege then null; end $$;
do $$ begin
    update public.media_request set chosen_rank = 1;
    raise exception 'FAIL: worker approved its own option';
exception when insufficient_privilege then null; end $$;
do $$ begin
    insert into public.media_request (media_type, tmdb_id, requested_by)
        values ('movie', 603, '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: worker created a request';
exception when insufficient_privilege then null; end $$;
do $$ begin
    delete from public.media_request;
    raise exception 'FAIL: worker deleted requests';
exception when insufficient_privilege then null; end $$;
do $$ begin
    perform library_account from public.media_member;
    raise exception 'FAIL: worker read library accounts';
exception when insufficient_privilege then null; end $$;
do $$ begin
    update public.media_member set revoked_at = null;
    raise exception 'FAIL: worker changed membership';
exception when insufficient_privilege then null; end $$;
do $$ begin
    insert into public.media_request_follower (request_id, user_id)
        select id, '00000000-0000-0000-0000-0000000000a1' from public.media_request where tmdb_id = 27205;
    raise exception 'FAIL: worker added a follower';
exception when insufficient_privilege then null; end $$;
do $$ begin
    perform 1 from public.profiles;
    raise exception 'FAIL: worker read profiles';
exception when insufficient_privilege then null; end $$;
do $$ begin
    perform 1 from auth.users;
    raise exception 'FAIL: worker read auth.users';
exception when insufficient_privilege then null; end $$;

-- Options: replace freely, never edit in place.
do $$ begin
    delete from public.media_request_option;
    insert into public.media_request_option (request_id, rank, label, reason)
        select id, 1, 'Pick', 'best match' from public.media_request where tmdb_id = 157336;
    assert (select count(*) from public.media_request_option) = 1, 'worker replaced options';
end $$;
do $$ begin
    update public.media_request_option set label = 'Edited';
    raise exception 'FAIL: worker edited an option in place';
exception when insufficient_privilege then null; end $$;

-- Heartbeat yes, kill switch no.
do $$ begin
    update public.media_worker_status set last_run_at = now(), mode = 'dry', detail = 'ok';
end $$;
do $$ begin
    update public.media_worker_status set paused = false;
    raise exception 'FAIL: worker flipped the kill switch';
exception when insufficient_privilege then null; end $$;
do $$ begin
    insert into public.media_worker_status (id) values (false);
    raise exception 'FAIL: worker inserted a status row';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '== updated_at trigger fires for worker updates'
select updated_at as before_update from public.media_request where tmdb_id = 27205 \gset
set role media_worker;
update public.media_request set status_detail = 'touched' where tmdb_id = 27205;
reset role;
select updated_at > :'before_update'::timestamptz as updated_at_moved
    from public.media_request where tmdb_id = 27205 \gset
\if :updated_at_moved
\else
    do $$ begin raise exception 'FAIL: updated_at must move on update'; end $$;
\endif

-- ---------------------------------------------------------------------------
\echo '== service_role: full access (used by the app route and admin actions)'
begin;
set local role service_role;
insert into public.media_request (media_type, tmdb_id, requested_by)
    values ('movie', 603, '00000000-0000-0000-0000-0000000000b1');
update public.media_request set chosen_rank = 1, status = 'approved' where tmdb_id = 157336;
update public.media_member set revoked_at = now() where user_id = '00000000-0000-0000-0000-0000000000c1';
update public.media_worker_status set paused = true;
do $$ begin perform 1 from public.media_request_option; end $$;
rollback;

-- ---------------------------------------------------------------------------
\echo '== constraints'
do $$ begin
    insert into public.media_request (media_type, tmdb_id, requested_by)
        values ('movie', 0, '00000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL: non-positive tmdb_id accepted';
exception when check_violation then null; end $$;
do $$ begin
    insert into public.media_request (media_type, tmdb_id, requested_by)
        values ('person', 1, '00000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL: unknown media type accepted';
exception when check_violation then null; end $$;
do $$ begin
    insert into public.media_request (media_type, tmdb_id, status, requested_by)
        values ('movie', 1, 'done', '00000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL: unknown status accepted';
exception when check_violation then null; end $$;
do $$ begin
    insert into public.media_request (media_type, tmdb_id, requested_by)
        values ('movie', 157336, '00000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL: duplicate title row accepted';
exception when unique_violation then null; end $$;
do $$ begin
    insert into public.media_request (media_type, tmdb_id, status_detail, requested_by)
        values ('movie', 1, repeat('x', 301), '00000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL: oversized status_detail accepted';
exception when check_violation then null; end $$;
do $$ begin
    insert into public.media_member (user_id, library_account)
        values ('00000000-0000-0000-0000-0000000000e1', 'ALICE');
    raise exception 'FAIL: library account reused with different case';
exception when unique_violation then null; end $$;
do $$ begin
    insert into public.media_member (user_id, library_account)
        values ('00000000-0000-0000-0000-0000000000e1', 'eve smith');
    raise exception 'FAIL: library account with a space accepted';
exception when check_violation then null; end $$;
do $$ begin
    insert into public.media_worker_status (id) values (false);
    raise exception 'FAIL: second worker status row accepted';
exception when check_violation then null; end $$;
do $$ begin
    insert into public.media_request_option (request_id, rank, label)
        select id, 4, 'x' from public.media_request where tmdb_id = 157336;
    raise exception 'FAIL: option rank 4 accepted';
exception when check_violation then null; end $$;

\echo '== all media request tests passed'
