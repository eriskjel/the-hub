-- Members' request actions run in one transaction with the service role.
-- The app checks the user's session and access before calling these functions;
-- p_weekly_quota is null for admins. Creating or reopening uses the quota,
-- while joining an existing open request is free.
--
-- media_request_add returns requested, reopened, followed, already_requested,
-- already_following, available, closed or quota_exceeded.
-- media_request_cancel returns cancelled, handed_over or not_cancellable.
-- media_request_unfollow returns unfollowed or changed.

-- Membership and admin access use the same eligibility rule during handover.
create or replace function public.media_request_has_access(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.media_member
         where user_id = p_user and revoked_at is null
    ) or exists (
        select 1 from auth.users u
         where u.id = p_user
           and (
               lower(u.raw_app_meta_data ->> 'role') = 'admin'
               or exists (
                   select 1 from jsonb_array_elements_text(
                       case when jsonb_typeof(u.raw_app_meta_data -> 'roles') = 'array'
                            then u.raw_app_meta_data -> 'roles' else '[]'::jsonb end
                   ) as roles(role)
                   where lower(roles.role) = 'admin'
               )
           )
    );
$$;

revoke all on function public.media_request_has_access(uuid) from public, anon, authenticated, media_worker;
grant execute on function public.media_request_has_access(uuid) to service_role;

-- Creating, reopening and joining share the per-user quota lock and a row
-- lock on the request. Status changes wait until its follower insert commits.
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
               set requested_by = p_user, status = 'wanted', status_detail = null,
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
    update public.media_request set status = 'cancelled' where id = p_request_id;
    return 'cancelled';
end;
$$;

revoke all on function public.media_request_cancel(uuid, bigint) from public, anon, authenticated, media_worker;
grant execute on function public.media_request_cancel(uuid, bigint) to service_role;

-- Unfollow locks the request first, just like joining and handing it over.
create or replace function public.media_request_unfollow(p_user uuid, p_request_id bigint)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
    perform 1 from public.media_request where id = p_request_id for update;
    if not found then return 'changed'; end if;
    delete from public.media_request_follower
     where request_id = p_request_id and user_id = p_user;
    if found then return 'unfollowed'; end if;
    return 'changed';
end;
$$;

revoke all on function public.media_request_unfollow(uuid, bigint) from public, anon, authenticated, media_worker;
grant execute on function public.media_request_unfollow(uuid, bigint) to service_role;
