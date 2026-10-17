\set ON_ERROR_STOP 1
\set QUIET 1

\echo '== removal: privileges'
do $$ begin
    assert has_column_privilege('media_worker', 'public.media_request', 'remove_at', 'UPDATE'),
        'the worker schedules removals';
    assert not has_column_privilege('media_worker', 'public.media_request', 'remove_after_days', 'UPDATE'),
        'only the hub writes the requester''s choice';
    assert not has_column_privilege('authenticated', 'public.media_request', 'remove_after_days', 'UPDATE');
    assert not has_column_privilege('authenticated', 'public.media_request', 'remove_at', 'UPDATE');

    assert has_function_privilege('service_role', 'public.media_request_keep(uuid, bigint)', 'EXECUTE');
    assert not has_function_privilege('authenticated', 'public.media_request_keep(uuid, bigint)', 'EXECUTE');
    assert not has_function_privilege('anon', 'public.media_request_keep(uuid, bigint)', 'EXECUTE');
    assert not has_function_privilege('media_worker', 'public.media_request_keep(uuid, bigint)', 'EXECUTE');

    assert to_regprocedure('public.media_request_add(uuid, text, int, int, text)') is null,
        'the old signature is gone, so PostgREST has one function to choose';
    assert has_function_privilege('service_role', 'public.media_request_add(uuid, text, int, int, text, int)', 'EXECUTE');
    assert not has_function_privilege('authenticated', 'public.media_request_add(uuid, text, int, int, text, int)', 'EXECUTE');
    assert not has_function_privilege('media_worker', 'public.media_request_add(uuid, text, int, int, text, int)', 'EXECUTE');
end $$;

\echo '== removal: the choice, +1s, keeping and asking again'
begin;
insert into auth.users (id) values
    ('00000000-0000-0000-0000-0000000000a6'),
    ('00000000-0000-0000-0000-0000000000b6');
insert into public.media_member (user_id, library_account) values
    ('00000000-0000-0000-0000-0000000000a6', 'removal-alice'),
    ('00000000-0000-0000-0000-0000000000b6', 'removal-bob');

set local role service_role;
do $$
declare
    alice constant uuid := '00000000-0000-0000-0000-0000000000a6';
    bob   constant uuid := '00000000-0000-0000-0000-0000000000b6';
    r public.media_request;
begin
    assert public.media_request_add(alice, 'movie', 960001, null, null, 30) = 'requested';
    assert public.media_request_add(alice, 'movie', 960002, null) = 'requested';
    assert (select remove_after_days from public.media_request where tmdb_id = 960001) = 30,
        'the requester''s choice is kept';
    assert (select remove_after_days is null from public.media_request where tmdb_id = 960002),
        'without a choice the title stays';
    begin
        perform public.media_request_add(alice, 'movie', 960003, null, null, 0);
        raise exception 'accepted 0 days';
    exception when check_violation then null;
    end;

    -- Added and due: a +1 now keeps it; a title that isn't temporary is simply available.
    update public.media_request set status = 'available', fulfilled_at = now(), remove_at = now()
     where tmdb_id in (960001, 960002);
    assert public.media_request_add(bob, 'movie', 960002, 0) = 'available',
        'a title that stays takes no +1';
    assert public.media_request_add(alice, 'movie', 960001, 0) = 'already_requested';
    assert public.media_request_add(bob, 'movie', 960001, 0) = 'followed',
        'a +1 on a temporary title is free and keeps it';

    -- Only the requester keeps it, and only while removal is ahead.
    select * into r from public.media_request where tmdb_id = 960001;
    assert public.media_request_keep(bob, r.id) = 'changed', 'a follower can''t keep it for the requester';
    assert public.media_request_keep(alice, r.id) = 'kept';
    assert (select remove_after_days is null and remove_at is null from public.media_request where id = r.id),
        'keeping clears the choice and the date';
    assert public.media_request_keep(alice, r.id) = 'changed', 'nothing left to keep';
    assert public.media_request_keep(alice, -1) = 'changed';

    -- Removed: asking again reopens it as new, with the new requester's choice.
    update public.media_request set status = 'removed', remove_after_days = 30, remove_at = now() where id = r.id;
    assert public.media_request_keep(alice, r.id) = 'changed', 'a removed title can''t be kept';
    assert public.media_request_add(bob, 'movie', 960001, 0) = 'quota_exceeded',
        'asking for a removed title again is a new request';
    assert public.media_request_add(bob, 'movie', 960001, null) = 'reopened';
    select * into r from public.media_request where id = r.id;
    assert r.requested_by = bob and r.status = 'wanted' and r.remove_after_days is null and r.remove_at is null,
        'the reopened request is bob''s and starts over without a removal';
    update public.media_request set status = 'cancelled' where id = r.id;
    assert public.media_request_add(alice, 'movie', 960001, null, null, 7) = 'reopened';
    assert (select remove_after_days from public.media_request where id = r.id) = 7,
        'reopening takes the new choice';
end $$;

\echo '== removal: admin keep, search again and mark available'
do $$
declare
    r public.media_request;
begin
    update public.media_request set status = 'available', remove_after_days = 30, remove_at = now()
     where tmdb_id = 960001 returning * into r;
    assert public.media_request_admin_update(r.id, 'keep', r.updated_at) = 'kept',
        'an admin keeps an available title';
    select * into r from public.media_request where id = r.id;
    assert r.remove_after_days is null and r.remove_at is null;
    assert public.media_request_admin_update(r.id, 'keep', r.updated_at) = 'not_allowed',
        'nothing left to keep';

    update public.media_request set status = 'removed', remove_after_days = 30, remove_at = now()
     where id = r.id returning * into r;
    assert public.media_request_admin_update(r.id, 'keep', r.updated_at) = 'not_allowed',
        'a removed title can''t be kept';
    assert public.media_request_admin_update(r.id, 'requeue', r.updated_at) = 'requeued';
    select * into r from public.media_request where id = r.id;
    assert r.remove_after_days = 30 and r.remove_at is null,
        'searching again keeps the choice and starts the clock over';

    assert public.media_request_admin_update(r.id, 'available', r.updated_at) = 'available';
    assert (select remove_after_days is null and remove_at is null from public.media_request where id = r.id),
        'a title marked available by hand stays';
end $$;

reset role;
\echo '== removal: the worker removes and schedules, nothing else'
set local role media_worker;
do $$ begin
    update public.media_request set remove_at = now() + interval '30 days', status = 'removed'
     where tmdb_id = 960002;
    begin
        update public.media_request set remove_after_days = null where tmdb_id = 960002;
        raise exception 'the worker changed the requester''s choice';
    exception when insufficient_privilege then null;
    end;
end $$;
rollback;
\echo '== all removal tests passed'
