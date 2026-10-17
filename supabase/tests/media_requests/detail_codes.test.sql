\set ON_ERROR_STOP 1
\echo '== message codes: constraints, worker grants and transitions'
begin;
insert into auth.users (id) values
    ('00000000-0000-0000-0000-00000000d101'),
    ('00000000-0000-0000-0000-00000000d102');
insert into public.media_member (user_id, granted_by) values
    ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-00000000d101'),
    ('00000000-0000-0000-0000-00000000d102', '00000000-0000-0000-0000-00000000d101');
insert into public.media_request (media_type, tmdb_id, requested_by)
    values ('movie', 930001, '00000000-0000-0000-0000-00000000d101');

set local role media_worker;
update public.media_request set detail_code = 'future_code', detail_args = '{"label":"Name"}', status_detail = 'Fallback'
    where tmdb_id = 930001;
do $$
declare bad jsonb; code text; boundary jsonb;
begin
    assert (select detail_code = 'future_code' and detail_args = '{"label":"Name"}'::jsonb
              from public.media_request where tmdb_id = 930001), 'worker can write and read future codes';
    boundary := jsonb_build_object('label', repeat('x', 4096 - octet_length('{"label": ""}'::jsonb::text)));
    assert octet_length(boundary::text) = 4096;
    update public.media_request set detail_code = repeat('a', 40), detail_args = boundary where tmdb_id = 930001;
    assert (select octet_length(detail_args::text) = 4096 and char_length(detail_code) = 40
              from public.media_request where tmdb_id = 930001), 'maximum code length and exact byte limit accepted';
    begin
        update public.media_request set detail_args = jsonb_build_object('label', (boundary->>'label') || 'x') where tmdb_id = 930001;
        raise exception 'accepted 4097 bytes';
    exception when check_violation then null;
    end;
    update public.media_request set detail_code = 'paused', detail_args = '{}' where tmdb_id = 930001;
    assert (select detail_args = '{}'::jsonb from public.media_request where tmdb_id = 930001), 'empty arguments accepted';
    update public.media_request set detail_code = 'future_code', detail_args = '{"label":"Name"}' where tmdb_id = 930001;
    foreach bad in array array['null'::jsonb, '[]'::jsonb, '"text"'::jsonb, '{"n":1}'::jsonb,
                               '{"n":null}'::jsonb, '{"n":{}}'::jsonb, '{"n":[]}'::jsonb,
                               jsonb_build_object('label', repeat('x', 4096))] loop
        begin
            update public.media_request set detail_args = bad where tmdb_id = 930001;
            raise exception 'accepted invalid detail arguments: %', bad;
        exception when check_violation then null;
        end;
    end loop;
    foreach code in array array['', 'Uppercase', 'has-hyphen', repeat('x', 41)] loop
        begin
            update public.media_request set detail_code = code where tmdb_id = 930001;
            raise exception 'accepted invalid code: %', code;
        exception when check_violation then null;
        end;
    end loop;
    begin
        update public.media_request set detail_args = null where tmdb_id = 930001;
        raise exception 'accepted a code without arguments';
    exception when check_violation then null;
    end;
    begin
        update public.media_request set detail_code = null where tmdb_id = 930001;
        raise exception 'accepted arguments without a code';
    exception when check_violation then null;
    end;
end $$;

reset role;
do $$ begin
    assert not has_function_privilege('authenticated', 'public.media_detail_args_valid(jsonb)', 'EXECUTE'),
        'members have no validator RPC permission';
    assert not has_function_privilege('anon', 'public.media_detail_args_valid(jsonb)', 'EXECUTE');
    assert has_function_privilege('media_worker', 'public.media_detail_args_valid(jsonb)', 'EXECUTE');
    assert has_function_privilege('service_role', 'public.media_detail_args_valid(jsonb)', 'EXECUTE');
    assert not has_column_privilege('authenticated', 'public.media_request', 'detail_code', 'UPDATE');
    assert not has_column_privilege('authenticated', 'public.media_request', 'detail_args', 'UPDATE');
    assert not has_column_privilege('anon', 'public.media_request', 'detail_code', 'SELECT');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000d101', true);
do $$ begin
    assert (select detail_code = 'future_code' from public.media_request where tmdb_id = 930001),
        'active members can read the new fields under existing RLS';
end $$;

reset role;
set local role service_role;
do $$
declare
    r public.media_request;
    intent text;
    owner constant uuid := '00000000-0000-0000-0000-00000000d101';
    successor constant uuid := '00000000-0000-0000-0000-00000000d102';
begin
    foreach intent in array array['requeue', 'decline', 'available'] loop
        update public.media_request
           set status = 'proposed', detail_code = 'suggested', detail_args = '{"label":"Old"}', status_detail = 'Old'
         where tmdb_id = 930001 returning * into r;
        assert public.media_request_admin_update(r.id, intent, r.updated_at) =
            case intent when 'requeue' then 'requeued' when 'decline' then 'declined' else 'available' end,
            format('%s reports success', intent);
        assert (select status = case intent when 'requeue' then 'wanted' when 'decline' then 'declined' else 'available' end
                  from public.media_request where id = r.id), format('%s updates status', intent);
        assert (select detail_code is null and detail_args is null and status_detail is null
                  from public.media_request where id = r.id), format('%s clears all detail fields', intent);
    end loop;

    insert into public.media_request_option (request_id, rank, label) values (r.id, 1, 'Chosen label');
    update public.media_request
       set status = 'proposed', detail_code = 'suggested', detail_args = '{"label":"Old"}', status_detail = 'Old'
     where id = r.id returning * into r;
    assert public.media_request_admin_approve(r.id, 1, r.updated_at) = 'approved';
    assert (select detail_code is null and detail_args is null and status_detail = 'Chosen label'
              from public.media_request where id = r.id), 'approval clears the proposal code and keeps its label fallback';
    -- The old worker can still report a failure after hub approval.
    update public.media_request set status_detail = 'Adding failed' where id = r.id;
    assert (select detail_code is null and status_detail = 'Adding failed'
              from public.media_request where id = r.id), 'no stale release code masks an old worker failure';

    update public.media_request set status = 'wanted', detail_code = 'paused', detail_args = '{}', status_detail = 'Paused'
     where id = r.id;
    insert into public.media_request_follower (request_id, user_id) values (r.id, successor);
    assert public.media_request_cancel(owner, r.id) = 'handed_over';
    assert (select detail_code = 'paused' and detail_args = '{}'::jsonb and status_detail = 'Paused'
              from public.media_request where id = r.id), 'handover preserves the processing detail';
    assert public.media_request_cancel(successor, r.id) = 'cancelled';
    assert (select detail_code is null and detail_args is null and status_detail is null
              from public.media_request where id = r.id), 'actual cancellation clears all detail fields';

    update public.media_request set detail_code = 'paused', detail_args = '{}', status_detail = 'Old'
     where id = r.id;
    assert public.media_request_add(owner, 'movie', 930001, null) = 'reopened';
    assert (select detail_code is null and detail_args is null and status_detail is null
              from public.media_request where id = r.id), 'reopen clears all detail fields';
end $$;
rollback;
\echo '== message code tests passed'
