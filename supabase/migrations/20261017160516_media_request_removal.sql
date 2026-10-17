-- "Remove after me": the requester can ask for a title to leave the library
-- some days after it's added, which keeps the shared library tidy.
--
--   * remove_after_days is the requester's choice; null keeps the title. Only
--     the hub writes it, and the requester or an admin can clear it ("Keep").
--   * remove_at is set by the worker, and only for a release it added itself
--     for this request. A title that was already in the library, or that an
--     admin marked available, is never removed.
--   * A +1 keeps the title: the worker doesn't remove a request with followers.
--   * A removed request is 'removed', and asking again reopens it.
alter table public.media_request
    add column if not exists remove_after_days int null,
    add column if not exists remove_at timestamptz null;

alter table public.media_request drop constraint if exists mr_remove_after_days_range;
alter table public.media_request add constraint mr_remove_after_days_range
    check (remove_after_days between 1 and 365);

alter table public.media_request drop constraint if exists mr_status_check;
alter table public.media_request add constraint mr_status_check check (status in (
    'wanted', 'searching', 'proposed', 'approved', 'downloading',
    'available', 'failed', 'declined', 'cancelled', 'removed'));

grant update (remove_at) on public.media_request to media_worker;

-- As in 20261017155211, plus the requester's removal choice. A +1 on a title
-- that's due to be removed keeps it, and a removed title is asked for anew.
drop function if exists public.media_request_add(uuid, text, int, int, text);
create or replace function public.media_request_add(
    p_user uuid, p_media_type text, p_tmdb_id int, p_weekly_quota int,
    p_note text default null, p_remove_after_days int default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_request public.media_request;
    v_used int;
    v_id bigint;
    v_outcome text;
    v_note text := nullif(btrim(p_note), '');
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

        if found and v_request.status not in ('cancelled', 'removed') then
            if v_request.status = 'available' and v_request.remove_after_days is null then
                return 'available';
            end if;
            if v_request.status in ('failed', 'declined') then return 'closed'; end if;
            if v_request.requested_by = p_user then return 'already_requested'; end if;

            insert into public.media_request_follower (request_id, user_id)
            values (v_request.id, p_user)
            on conflict (request_id, user_id) do nothing;
            if not found then return 'already_following'; end if;
            v_id := v_request.id;
            v_outcome := 'followed';
            exit;
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
                   next_check_at = now(), created_at = now(), fulfilled_at = null,
                   remove_after_days = p_remove_after_days, remove_at = null
             where id = v_request.id;
            delete from public.media_request_follower
             where request_id = v_request.id and user_id = p_user;
            v_id := v_request.id;
            v_outcome := 'reopened';
            exit;
        end if;

        insert into public.media_request (media_type, tmdb_id, requested_by, remove_after_days)
        values (p_media_type, p_tmdb_id, p_user, p_remove_after_days)
        on conflict (media_type, tmdb_id) do nothing
        returning id into v_id;
        if v_id is not null then
            v_outcome := 'requested';
            exit;
        end if;
        -- Another user created the title; lock and inspect that row next.
    end loop;

    if v_note is not null then
        insert into public.media_request_note (request_id, user_id, note)
        values (v_id, p_user, v_note)
        on conflict (request_id, user_id) do update set note = excluded.note, created_at = now();
    end if;
    return v_outcome;
end;
$$;

revoke all on function public.media_request_add(uuid, text, int, int, text, int)
    from public, anon, authenticated, media_worker;
grant execute on function public.media_request_add(uuid, text, int, int, text, int) to service_role;

-- The requester keeps the title after all. The row lock waits for a removal
-- the worker has started, which then wins.
create or replace function public.media_request_keep(p_user uuid, p_request_id bigint)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_request public.media_request;
begin
    select * into v_request from public.media_request where id = p_request_id for update;
    if not found or v_request.requested_by is distinct from p_user
       or v_request.remove_after_days is null
       or v_request.status not in ('wanted', 'searching', 'proposed', 'approved', 'downloading', 'available') then
        return 'changed';
    end if;
    update public.media_request set remove_after_days = null, remove_at = null where id = p_request_id;
    return 'kept';
end;
$$;

revoke all on function public.media_request_keep(uuid, bigint) from public, anon, authenticated, media_worker;
grant execute on function public.media_request_keep(uuid, bigint) to service_role;

-- As in 20261017101024, plus "keep", which only changes the removal and so
-- works whoever holds the request. Searching again starts the removal clock
-- over; marking available by hand means the title stays.
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

    if p_intent = 'keep' then
        if v_request.remove_after_days is null or v_request.status not in
           ('wanted', 'searching', 'proposed', 'approved', 'downloading', 'available') then
            return 'not_allowed';
        end if;
        update public.media_request set remove_after_days = null, remove_at = null where id = p_request_id;
        return 'kept';
    end if;

    if v_request.status in ('searching', 'downloading', 'available') then
        return 'not_allowed';
    end if;

    if p_intent = 'requeue' then
        update public.media_request
           set status = 'wanted', chosen_rank = null, status_detail = null, detail_code = null, detail_args = null,
               attempts = 0, claimed_at = null, next_check_at = now(), fulfilled_at = null, remove_at = null
         where id = p_request_id;
        delete from public.media_request_option where request_id = p_request_id;
        return 'requeued';
    elsif p_intent = 'available' then
        update public.media_request
           set status = 'available', chosen_rank = null, claimed_at = null,
               status_detail = null, detail_code = null, detail_args = null, fulfilled_at = now(),
               remove_after_days = null, remove_at = null
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

-- Everything open or available when this arrives becomes temporary, as the
-- admin decided. Only what the worker adds itself is ever removed. The
-- trigger is off so the admin page's "by last change" order stays true.
alter table public.media_request disable trigger mr_touch_updated_at;
update public.media_request set remove_after_days = 30
 where remove_after_days is null
   and status in ('wanted', 'searching', 'proposed', 'approved', 'downloading', 'available');
alter table public.media_request enable trigger mr_touch_updated_at;
