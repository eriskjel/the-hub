-- Admin request actions use the service role after the app checks admin access.
-- The displayed updated_at prevents a stale page from changing newer work.
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
    if v_request.status in ('searching', 'approved', 'downloading', 'available') then
        return 'not_allowed';
    end if;

    if p_intent = 'requeue' then
        update public.media_request
           set status = 'wanted', chosen_rank = null, status_detail = null,
               attempts = 0, claimed_at = null, next_check_at = now(), fulfilled_at = null
         where id = p_request_id;
        delete from public.media_request_option where request_id = p_request_id;
        return 'requeued';
    elsif p_intent = 'available' then
        update public.media_request
           set status = 'available', chosen_rank = null, claimed_at = null,
               status_detail = null, fulfilled_at = now()
         where id = p_request_id;
        return 'available';
    elsif p_intent = 'decline' and v_request.status in ('wanted', 'proposed', 'failed') then
        update public.media_request
           set status = 'declined', chosen_rank = null, claimed_at = null,
               status_detail = null, fulfilled_at = null
         where id = p_request_id;
        return 'declined';
    end if;
    return 'not_allowed';
end;
$$;

revoke all on function public.media_request_admin_update(bigint, text, timestamptz)
    from public, anon, authenticated, media_worker;
grant execute on function public.media_request_admin_update(bigint, text, timestamptz) to service_role;

-- The pause flag is independent of the worker's heartbeat columns.
create or replace function public.media_worker_set_paused(p_paused boolean, p_expected_paused boolean)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_paused boolean;
begin
    if p_paused is null or p_expected_paused is null then return 'not_allowed'; end if;
    select paused into v_paused from public.media_worker_status where id = true for update;
    if not found or v_paused is distinct from p_expected_paused then return 'changed'; end if;
    update public.media_worker_status set paused = p_paused where id = true;
    return case when p_paused then 'paused' else 'resumed' end;
end;
$$;

revoke all on function public.media_worker_set_paused(boolean, boolean)
    from public, anon, authenticated, media_worker;
grant execute on function public.media_worker_set_paused(boolean, boolean) to service_role;
