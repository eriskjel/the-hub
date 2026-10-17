-- Services send codes and values; the hub owns translated display text.
alter table public.media_request
    add column if not exists detail_code text null,
    add column if not exists detail_args jsonb null;

-- A bounded flat string object, including {} for messages without values.
create or replace function public.media_detail_args_valid(p_args jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select case when jsonb_typeof(p_args) = 'object' then
        octet_length(p_args::text) <= 4096 and not exists (
            select 1 from jsonb_each(p_args) as arg
             where jsonb_typeof(arg.value) <> 'string'
        )
    else false end;
$$;
revoke all on function public.media_detail_args_valid(jsonb) from public, anon;
grant execute on function public.media_detail_args_valid(jsonb) to authenticated, service_role, media_worker;

alter table public.media_request drop constraint if exists mr_detail_code_format;
alter table public.media_request add constraint mr_detail_code_format
    check (detail_code ~ '^[a-z][a-z0-9_]{0,39}$');
alter table public.media_request drop constraint if exists mr_detail_args_shape;
alter table public.media_request add constraint mr_detail_args_shape
    check ((detail_code is null and detail_args is null) or
           (detail_code is not null and detail_args is not null and
            public.media_detail_args_valid(detail_args)));
grant update (detail_code, detail_args) on public.media_request to media_worker;

-- Approval deliberately retains its label-only fallback until the worker claims
-- it. An older worker can still replace the label with an error during rollout.
-- An admin approves one of the worker's proposed options, and the worker adds
-- it. The chosen option's label becomes the note, so everyone sees what is
-- being added. The displayed updated_at prevents a stale page from approving.
create or replace function public.media_request_admin_approve(
    p_request_id bigint, p_rank int, p_expected_updated_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_request public.media_request;
    v_label text;
begin
    select * into v_request from public.media_request where id = p_request_id for update;
    if not found or v_request.updated_at is distinct from p_expected_updated_at then
        return 'changed';
    end if;
    if v_request.status <> 'proposed' then return 'not_allowed'; end if;
    select label into v_label from public.media_request_option
     where request_id = p_request_id and rank = p_rank;
    if not found then return 'not_allowed'; end if;

    update public.media_request
       set status = 'approved', chosen_rank = p_rank, status_detail = v_label, detail_code = null, detail_args = null,
           next_check_at = now()
     where id = p_request_id;
    return 'approved';
end;
$$;

revoke all on function public.media_request_admin_approve(bigint, int, timestamptz)
    from public, anon, authenticated, media_worker;
grant execute on function public.media_request_admin_approve(bigint, int, timestamptz) to service_role;

-- The worker only holds a request while it is searching or downloading. An
-- approved request waits for it to start, so until then the admin can still
-- re-queue, decline or mark it available. Otherwise as in 20261013202716.
create or replace function public.media_request_admin_update(
    p_request_id bigint, p_intent text, p_expected_updated_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_request public.media_request;
begin
    select * into v_request from public.media_request where id = p_request_id for update;
    if not found or v_request.updated_at is distinct from p_expected_updated_at then
        return 'changed';
    end if;
    if v_request.status in ('searching', 'downloading', 'available') then
        return 'not_allowed';
    end if;

    if p_intent = 'requeue' then
        update public.media_request
           set status = 'wanted', chosen_rank = null, status_detail = null, detail_code = null, detail_args = null,
               attempts = 0, claimed_at = null, next_check_at = now(), fulfilled_at = null
         where id = p_request_id;
        delete from public.media_request_option where request_id = p_request_id;
        return 'requeued';
    elsif p_intent = 'available' then
        update public.media_request
           set status = 'available', chosen_rank = null, claimed_at = null,
               status_detail = null, detail_code = null, detail_args = null, fulfilled_at = now()
         where id = p_request_id;
        return 'available';
    elsif p_intent = 'decline' and v_request.status in ('wanted', 'proposed', 'approved', 'failed') then
        update public.media_request
           set status = 'declined', chosen_rank = null, claimed_at = null,
               status_detail = null, detail_code = null, detail_args = null, fulfilled_at = null
         where id = p_request_id;
        return 'declined';
    end if;
    return 'not_allowed';
end;
$$;

create or replace function public.media_request_add(
    p_user uuid, p_media_type text, p_tmdb_id int, p_weekly_quota int
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_request public.media_request;
    v_used int;
begin
    perform pg_advisory_xact_lock(hashtextextended('media_request_add:' || p_user::text, 0));
    -- A title lock also covers the first insert, before a request row exists.
    perform pg_advisory_xact_lock(hashtextextended(
        'media_request_title:' || p_media_type || ':' || p_tmdb_id::text, 0
    ));

    loop
        select * into v_request from public.media_request
         where media_type = p_media_type and tmdb_id = p_tmdb_id
         for update;

        if found and v_request.status <> 'cancelled' then
            if v_request.status = 'available' then return 'available'; end if;
            if v_request.status in ('failed', 'declined') then return 'closed'; end if;
            if v_request.requested_by = p_user then return 'already_requested'; end if;

            insert into public.media_request_follower (request_id, user_id)
            values (v_request.id, p_user)
            on conflict (request_id, user_id) do nothing;
            if found then return 'followed'; end if;
            return 'already_following';
        end if;

        if p_weekly_quota is not null then
            select count(*) into v_used from public.media_request
             where requested_by = p_user and status <> 'cancelled'
               and created_at >= now() - interval '7 days';
            if v_used >= p_weekly_quota then return 'quota_exceeded'; end if;
        end if;

        if v_request.id is not null then
            update public.media_request
               set requested_by = p_user, status = 'wanted', status_detail = null, detail_code = null, detail_args = null,
                   chosen_rank = null, attempts = 0, claimed_at = null,
                   next_check_at = now(), created_at = now(), fulfilled_at = null
             where id = v_request.id;
            delete from public.media_request_follower
             where request_id = v_request.id and user_id = p_user;
            return 'reopened';
        end if;

        insert into public.media_request (media_type, tmdb_id, requested_by)
        values (p_media_type, p_tmdb_id, p_user)
        on conflict (media_type, tmdb_id) do nothing;
        if found then return 'requested'; end if;
        -- Another user created the title; lock and inspect that row next.
    end loop;
end;
$$;

revoke all on function public.media_request_add(uuid, text, int, int) from public, anon, authenticated, media_worker;
grant execute on function public.media_request_add(uuid, text, int, int) to service_role;

-- Cancellation, successor selection and follower removal commit together.
create or replace function public.media_request_cancel(p_user uuid, p_request_id bigint)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_request public.media_request;
    v_next uuid;
begin
    select * into v_request from public.media_request
     where id = p_request_id for update;
    if not found or v_request.requested_by is distinct from p_user
       or v_request.status not in ('wanted', 'proposed') then
        return 'not_cancellable';
    end if;

    select f.user_id into v_next from public.media_request_follower f
     where f.request_id = p_request_id and f.user_id <> p_user
       and public.media_request_has_access(f.user_id)
     order by f.created_at, f.user_id
     limit 1 for update of f;

    if v_next is not null then
        update public.media_request set requested_by = v_next where id = p_request_id;
        delete from public.media_request_follower
         where request_id = p_request_id and user_id = v_next;
        return 'handed_over';
    end if;
    update public.media_request set status = 'cancelled', status_detail = null,
        detail_code = null, detail_args = null where id = p_request_id;
    return 'cancelled';
end;
$$;

revoke all on function public.media_request_cancel(uuid, bigint) from public, anon, authenticated, media_worker;
grant execute on function public.media_request_cancel(uuid, bigint) to service_role;

