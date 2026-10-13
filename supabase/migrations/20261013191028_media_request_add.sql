-- Adds a request for a title in one step: the quota check and the write
-- happen together, one at a time per user, so the weekly quota always holds.
-- Called by the app with the service role after it has checked the user's
-- access; p_weekly_quota is null for users without a limit (admins).
--
-- Returns:
--   'requested'      a new request was created
--   'reopened'       a cancelled request for the title became this user's
--   'exists'         someone has an open request for it; the caller adds a +1
--   'quota_exceeded' the user has used this week's requests
create or replace function public.media_request_add(
    p_user         uuid,
    p_media_type   text,
    p_tmdb_id      int,
    p_weekly_quota int
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_used int;
begin
    -- Serialise per user until commit, so a second call counts the first.
    perform pg_advisory_xact_lock(hashtextextended('media_request_add:' || p_user::text, 0));

    -- Joining someone else's request is free, so check that before the quota.
    if exists (
        select 1
          from public.media_request
         where media_type = p_media_type
           and tmdb_id = p_tmdb_id
           and status <> 'cancelled'
    ) then
        return 'exists';
    end if;

    -- Same window as QUOTA_WINDOW_MS in the app: the last 7 days, cancelled
    -- requests not counted.
    if p_weekly_quota is not null then
        select count(*)
          into v_used
          from public.media_request
         where requested_by = p_user
           and status <> 'cancelled'
           and created_at >= now() - interval '7 days';
        if v_used >= p_weekly_quota then
            return 'quota_exceeded';
        end if;
    end if;

    update public.media_request
       set requested_by  = p_user,
           status        = 'wanted',
           status_detail = null,
           chosen_rank   = null,
           attempts      = 0,
           claimed_at    = null,
           next_check_at = now(),
           created_at    = now(),
           fulfilled_at  = null
     where media_type = p_media_type
       and tmdb_id = p_tmdb_id
       and status = 'cancelled';
    if found then
        return 'reopened';
    end if;

    insert into public.media_request (media_type, tmdb_id, requested_by)
    values (p_media_type, p_tmdb_id, p_user)
    on conflict (media_type, tmdb_id) do nothing;
    if found then
        return 'requested';
    end if;

    -- Someone else created it in the meantime.
    return 'exists';
end;
$$;

revoke all on function public.media_request_add(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.media_request_add(uuid, text, int, int) to service_role;
