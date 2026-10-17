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
       set status = 'approved', chosen_rank = p_rank, status_detail = v_label,
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
    elsif p_intent = 'decline' and v_request.status in ('wanted', 'proposed', 'approved', 'failed') then
        update public.media_request
           set status = 'declined', chosen_rank = null, claimed_at = null,
               status_detail = null, fulfilled_at = null
         where id = p_request_id;
        return 'declined';
    end if;
    return 'not_allowed';
end;
$$;
