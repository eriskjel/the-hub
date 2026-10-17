\set ON_ERROR_STOP 1
\set QUIET 1

\echo '== notes: privileges'
do $$
declare p text;
begin
    foreach p in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
        assert not has_table_privilege('authenticated', 'public.media_request_note', p),
            format('authenticated must not have %s on notes', p);
    end loop;
    foreach p in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
        assert not has_table_privilege('anon', 'public.media_request_note', p),
            format('anon must not have %s on notes', p);
        assert not has_table_privilege('media_worker', 'public.media_request_note', p),
            format('the worker must not have %s on notes', p);
    end loop;
    assert (select relrowsecurity from pg_class where oid = 'public.media_request_note'::regclass),
        'RLS must be enabled on notes';

    assert has_function_privilege('media_worker', 'public.media_request_has_note(bigint)', 'EXECUTE'),
        'the worker can ask whether a request has a note';
    assert not has_function_privilege('authenticated', 'public.media_request_has_note(bigint)', 'EXECUTE');
    assert not has_function_privilege('anon', 'public.media_request_has_note(bigint)', 'EXECUTE');
end $$;

\echo '== notes: saved when the call adds the user, removed when they leave'
begin;
insert into auth.users (id) values
    ('00000000-0000-0000-0000-0000000000a5'),
    ('00000000-0000-0000-0000-0000000000b5'),
    ('00000000-0000-0000-0000-0000000000c5');
insert into public.media_member (user_id, library_account, revoked_at) values
    ('00000000-0000-0000-0000-0000000000a5', 'notes-alice', null),
    ('00000000-0000-0000-0000-0000000000b5', 'notes-bob', null),
    ('00000000-0000-0000-0000-0000000000c5', 'notes-carol', now());

set local role service_role;
do $$
declare
    alice constant uuid := '00000000-0000-0000-0000-0000000000a5';
    bob   constant uuid := '00000000-0000-0000-0000-0000000000b5';
    v_id bigint;
begin
    assert public.media_request_add(alice, 'movie', 950001, null, '  The extended cut  ') = 'requested';
    select id into v_id from public.media_request where tmdb_id = 950001;
    assert (select note from public.media_request_note where request_id = v_id and user_id = alice)
           = 'The extended cut', 'a new request keeps its trimmed note';

    assert public.media_request_add(alice, 'movie', 950001, null, 'Changed my mind') = 'already_requested';
    assert (select note from public.media_request_note where request_id = v_id and user_id = alice)
           = 'The extended cut', 'a call that adds nothing leaves the note alone';

    assert public.media_request_add(bob, 'movie', 950001, 0, 'Theatrical is fine too') = 'followed',
        'a +1 can carry a note';
    assert (select count(*) from public.media_request_note where request_id = v_id) = 2;

    assert public.media_request_add(alice, 'movie', 950002, null, '   ') = 'requested';
    assert public.media_request_add(alice, 'movie', 950003, null) = 'requested';
    assert not exists (select 1 from public.media_request_note n join public.media_request r on r.id = n.request_id
                        where r.tmdb_id in (950002, 950003)), 'a blank or missing note is no note';

    assert public.media_request_add(bob, 'movie', 950004, 0, 'Over quota') = 'quota_exceeded';
    assert not exists (select 1 from public.media_request where tmdb_id = 950004),
        'a refused request leaves no note';

    begin
        perform public.media_request_add(alice, 'movie', 950005, null, repeat('x', 501));
        raise exception 'accepted a 501-character note';
    exception when check_violation then null;
    end;
    assert not exists (select 1 from public.media_request where tmdb_id = 950005),
        'a too-long note fails the whole request';

    -- The requester hands over to bob: her note goes, his stays with him.
    assert public.media_request_cancel(alice, v_id) = 'handed_over';
    assert not exists (select 1 from public.media_request_note where request_id = v_id and user_id = alice),
        'handing over removes the old requester''s note';
    assert exists (select 1 from public.media_request_note where request_id = v_id and user_id = bob),
        'the new requester keeps their note';
    assert public.media_request_cancel(bob, v_id) = 'cancelled';
    assert not exists (select 1 from public.media_request_note where request_id = v_id),
        'cancelling removes the requester''s note';

    assert public.media_request_add(alice, 'movie', 950001, null, 'Reopened with a note') = 'reopened';
    assert (select note from public.media_request_note where request_id = v_id and user_id = alice)
           = 'Reopened with a note', 'reopening saves the new note';

    assert public.media_request_add(bob, 'movie', 950001, 0, 'Me too') = 'followed';
    assert public.media_request_unfollow(bob, v_id) = 'unfollowed';
    assert not exists (select 1 from public.media_request_note where request_id = v_id and user_id = bob),
        'taking back a +1 removes its note';
    assert public.media_request_unfollow(bob, v_id) = 'changed';
end $$;

reset role;
\echo '== notes: only the author reads a note, and only with access'
insert into public.media_request_note (request_id, user_id, note)
    select id, '00000000-0000-0000-0000-0000000000c5', 'From a revoked member'
      from public.media_request where tmdb_id = 950003;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
do $$ begin
    assert (select count(*) from public.media_request_note) = 1, 'alice reads only her own note';
    assert (select note from public.media_request_note) = 'Reopened with a note';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', true);
do $$ begin
    assert not exists (select 1 from public.media_request_note), 'bob has no note and reads none';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c5', true);
do $$ begin
    assert not exists (select 1 from public.media_request_note), 'without access, not even your own note';
end $$;

reset role;
create function pg_temp.has_note(p_tmdb_id int) returns boolean language sql as $$
    select public.media_request_has_note(id) from public.media_request where tmdb_id = p_tmdb_id
$$;
set local role media_worker;
do $$ begin
    assert pg_temp.has_note(950001), 'the worker learns that a request has a note';
    assert not pg_temp.has_note(950002), 'and that one has none';
    assert not public.media_request_has_note(-1), 'a missing request has no note';
    begin
        perform 1 from public.media_request_note;
        raise exception 'the worker read a note';
    exception when insufficient_privilege then null;
    end;
end $$;
rollback;
\echo '== all note tests passed'
