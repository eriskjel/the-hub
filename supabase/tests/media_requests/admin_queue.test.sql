\set ON_ERROR_STOP 1
\set QUIET 1

\echo '== admin queue: service-role functions only'
do $$ declare fn text; denied text; begin
    foreach fn in array array['public.media_request_admin_update(bigint,text,timestamptz)',
                              'public.media_worker_set_paused(boolean,boolean)'] loop
        foreach denied in array array['anon', 'authenticated', 'media_worker'] loop
            assert not has_function_privilege(denied, fn, 'EXECUTE'), format('%s cannot execute %s', denied, fn);
        end loop;
        assert has_function_privilege('service_role', fn, 'EXECUTE');
    end loop;
end $$;

begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a2');
set local role service_role;
do $$
declare
    r public.media_request;
    s text;
    intent text;
    owner constant uuid := '00000000-0000-0000-0000-0000000000a2';
begin
    insert into public.media_request (media_type, tmdb_id, requested_by)
        values ('movie', 920001, owner) returning * into r;
    assert public.media_request_admin_update(r.id, 'decline', r.updated_at - interval '1 second') = 'changed',
        'a stale page cannot decline a request';
    assert public.media_request_admin_update(-1, 'decline', r.updated_at) = 'changed';
    assert public.media_request_admin_update(r.id, 'approve', r.updated_at) = 'not_allowed',
        'option approval is not an admin queue action';

    foreach s in array array['searching', 'approved', 'downloading', 'available'] loop
        update public.media_request set status = s where id = r.id returning * into r;
        foreach intent in array array['decline', 'requeue', 'available'] loop
            assert public.media_request_admin_update(r.id, intent, r.updated_at) = 'not_allowed',
                format('%s is protected from %s', s, intent);
            assert (select status from public.media_request where id = r.id) = s;
        end loop;
    end loop;

    foreach s in array array['wanted', 'proposed', 'failed'] loop
        update public.media_request set status = s where id = r.id returning * into r;
        assert public.media_request_admin_update(r.id, 'decline', r.updated_at) = 'declined';
        assert (select status from public.media_request where id = r.id) = 'declined';
    end loop;

    -- Shared requests can be administered after their requester was deleted.
    update public.media_request set status = 'wanted', requested_by = null where id = r.id returning * into r;
    assert public.media_request_admin_update(r.id, 'decline', r.updated_at) = 'declined';

    foreach s in array array['wanted', 'proposed', 'failed', 'declined', 'cancelled'] loop
        update public.media_request set status = s, requested_by = owner where id = r.id returning * into r;
        assert public.media_request_admin_update(r.id, 'available', r.updated_at) = 'available';
        assert (select status = 'available' and fulfilled_at is not null and claimed_at is null
                  from public.media_request where id = r.id), 'manual completion records fulfilment';
    end loop;

    insert into public.media_request_option (request_id, rank, label) values (r.id, 1, 'Option one');
    update public.media_request
       set status = 'failed', chosen_rank = 1, attempts = 4, claimed_at = now(),
           next_check_at = now() + interval '1 day', status_detail = 'Previous attempt'
     where id = r.id returning * into r;
    assert public.media_request_admin_update(r.id, 'requeue', r.updated_at) = 'requeued';
    assert (select status = 'wanted' and chosen_rank is null and attempts = 0
                   and claimed_at is null and next_check_at = now() and fulfilled_at is null
                   and status_detail is null and requested_by = owner and created_at = r.created_at
              from public.media_request where id = r.id), 'requeue resets processing and preserves ownership and queue age';
    assert not exists (select 1 from public.media_request_option where request_id = r.id),
        'requeue clears the selected rank before removing old options';

    foreach s in array array['wanted', 'proposed', 'failed', 'declined', 'cancelled'] loop
        update public.media_request set status = s, attempts = 2 where id = r.id returning * into r;
        assert public.media_request_admin_update(r.id, 'requeue', r.updated_at) = 'requeued';
    end loop;
end $$;

\echo '== admin queue: pause flag preserves worker status'
update public.media_worker_status set paused = false, mode = 'dry', last_run_at = now(), detail = 'Healthy' where id;
do $$ begin
    assert public.media_worker_set_paused(true, false) = 'paused';
    assert (select paused and mode = 'dry' and last_run_at = now() and detail = 'Healthy'
              from public.media_worker_status where id), 'pause preserves the heartbeat';
    assert public.media_worker_set_paused(false, false) = 'changed', 'a stale toggle cannot override a newer pause';
    assert (select paused from public.media_worker_status where id);
    assert public.media_worker_set_paused(false, true) = 'resumed';
    assert public.media_worker_set_paused(null, false) = 'not_allowed';
    assert public.media_worker_set_paused(true, null) = 'not_allowed';
end $$;
rollback;
\echo '== all admin queue tests passed'
