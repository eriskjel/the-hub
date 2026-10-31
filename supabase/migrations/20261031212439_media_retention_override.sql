-- The admin decides whether a title stays: "Keep in library" or "Remove after
-- N days" (1-365), set while approving a release or later from the menu. The
-- decision beats the requester's choice and every +1.
--
--   * remove_after_days stays the choice that applies, so the worker and the
--     hub keep reading one column. The requester's own choice is kept apart in
--     requester_remove_after_days, so the admin can hand the decision back.
--   * The decision lasts through a hand-over and "Search again". A member who
--     asks again after a removal or cancellation starts a new request, which
--     starts without it.
--   * The worker publishes removal_eligible: whether the title is a release it
--     added itself for this request, and that nothing else needs. The admin can
--     only remove an available title that is eligible.
--   * The removal date is N days from when the title became available, or from
--     the admin's change if that came later. retention_deadline holds it, so a
--     retry moves remove_at but not the date the hub shows.
alter table public.media_request
    add column if not exists requester_remove_after_days int null,
    add column if not exists admin_retention text null,
    add column if not exists admin_remove_after_days int null,
    add column if not exists retention_changed_by uuid null references public.profiles(id) on delete set null,
    add column if not exists retention_changed_at timestamptz null,
    add column if not exists retention_deadline timestamptz null,
    add column if not exists removal_eligible boolean null;

alter table public.media_request drop constraint if exists mr_retention_check;
alter table public.media_request add constraint mr_retention_check check (
    requester_remove_after_days between 1 and 365
    and admin_retention in ('keep', 'remove')
    and admin_remove_after_days between 1 and 365
    and (admin_retention is not distinct from 'remove') = (admin_remove_after_days is not null)
);

grant update (removal_eligible) on public.media_request to media_worker;

-- What each requester has chosen so far. The trigger is off so the admin
-- page's "by last change" order stays true, as in 20261017160516.
alter table public.media_request disable trigger mr_touch_updated_at;
update public.media_request set requester_remove_after_days = remove_after_days
 where admin_retention is null and requester_remove_after_days is distinct from remove_after_days;
alter table public.media_request enable trigger mr_touch_updated_at;

-- Keeps remove_after_days to the admin's decision whoever writes the row, and
-- the requester's own choice apart. Only media_request_set_retention changes
-- retention_changed_at, which tells its writes from everyone else's.
create or replace function public.media_retention_enforce()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if TG_OP = 'INSERT' then
        new.requester_remove_after_days := new.remove_after_days;
    elsif new.generation <> old.generation and new.created_at <> old.created_at then
        -- media_request_add starts a removed or cancelled request over, created_at
        -- included. "Search again" keeps created_at, and so the admin's decision.
        new.requester_remove_after_days := new.remove_after_days;
        new.admin_retention := null;
        new.admin_remove_after_days := null;
        new.retention_changed_by := null;
        new.retention_changed_at := null;
    elsif new.retention_changed_at is not distinct from old.retention_changed_at
          and (new.remove_after_days is distinct from old.remove_after_days
               or new.requested_by is distinct from old.requested_by) then
        -- The requester's Keep, or a hand-over.
        new.requester_remove_after_days := new.remove_after_days;
    end if;

    if new.admin_retention = 'keep' then
        new.remove_after_days := null;
        new.remove_at := null;
        new.retention_deadline := null;
    elsif new.admin_retention = 'remove' then
        new.remove_after_days := new.admin_remove_after_days;
    end if;

    -- A new request cycle, or a title that left the library: the worker
    -- decides again what it may remove.
    if TG_OP = 'UPDATE' and (new.generation <> old.generation
       or (old.status = 'available' and new.status <> 'available')) then
        new.removal_eligible := null;
        new.retention_deadline := null;
        new.remove_at := null;
    end if;

    if new.admin_retention = 'remove' and new.status = 'available'
       and new.removal_eligible and new.retention_deadline is null then
        new.retention_deadline := greatest(coalesce(new.fulfilled_at, now()), new.retention_changed_at)
            + make_interval(days => new.admin_remove_after_days);
        new.remove_at := new.retention_deadline;
    end if;
    return new;
end;
$$;

revoke all on function public.media_retention_enforce() from public, anon, authenticated;

drop trigger if exists mr_retention_enforce on public.media_request;
create trigger mr_retention_enforce
    before insert or update on public.media_request
    for each row execute function public.media_retention_enforce();

-- The admin's decision: 'keep', 'remove' after p_days, or 'requester' to hand
-- it back. Saving Remove again starts a new countdown. The server action checks
-- the admin and passes their id; the displayed updated_at stops a stale page.
-- The row lock waits for a removal the worker has started, which then wins.
create or replace function public.media_request_set_retention(
    p_request_id bigint, p_expected_updated_at timestamptz, p_actor uuid,
    p_policy text, p_days int default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_request public.media_request;
begin
    if p_actor is null or p_policy is null or p_policy not in ('requester', 'keep', 'remove')
       or (p_policy = 'remove') <> (p_days is not null) or p_days not between 1 and 365 then
        return 'not_allowed';
    end if;
    select * into v_request from public.media_request where id = p_request_id for update;
    if not found or v_request.updated_at is distinct from p_expected_updated_at then
        return 'changed';
    end if;
    if v_request.media_type <> 'movie' or v_request.status not in
       ('wanted', 'searching', 'proposed', 'approved', 'downloading', 'available') then
        return 'not_allowed';
    end if;
    if p_policy = 'remove' and v_request.status = 'available' and v_request.removal_eligible is not true then
        return 'not_removable';
    end if;
    if p_policy <> 'remove' and nullif(p_policy, 'requester') is not distinct from v_request.admin_retention then
        return 'retention_saved';
    end if;

    update public.media_request
       set admin_retention = nullif(p_policy, 'requester'), admin_remove_after_days = p_days,
           retention_changed_by = p_actor, retention_changed_at = clock_timestamp(),
           retention_deadline = null, remove_at = null,
           remove_after_days = case when p_policy = 'requester' then requester_remove_after_days end
     where id = p_request_id;
    return 'retention_saved';
end;
$$;

revoke all on function public.media_request_set_retention(bigint, timestamptz, uuid, text, int)
    from public, anon, authenticated, media_worker;
grant execute on function public.media_request_set_retention(bigint, timestamptz, uuid, text, int) to service_role;

-- Approves an option and sets the admin's decision in one transaction, so the
-- worker never adds the release without it. An unchanged decision stays as it
-- was, rather than starting a new countdown.
create or replace function public.media_request_approve_with_retention(
    p_request_id bigint, p_rank int, p_expected_updated_at timestamptz,
    p_actor uuid, p_policy text, p_days int default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_outcome text;
    v_unchanged boolean;
begin
    v_outcome := public.media_request_admin_approve(p_request_id, p_rank, p_expected_updated_at);
    if v_outcome <> 'approved' then return v_outcome; end if;
    select admin_retention is not distinct from nullif(p_policy, 'requester')
           and admin_remove_after_days is not distinct from p_days
      into v_unchanged
      from public.media_request where id = p_request_id;
    if v_unchanged then return 'approved'; end if;
    -- The approval just wrote the locked row, so its updated_at is now().
    v_outcome := public.media_request_set_retention(p_request_id, now(), p_actor, p_policy, p_days);
    if v_outcome <> 'retention_saved' then
        raise exception 'media_request_approve_with_retention: %', v_outcome;
    end if;
    return 'approved';
end;
$$;

revoke all on function public.media_request_approve_with_retention(bigint, int, timestamptz, uuid, text, int)
    from public, anon, authenticated, media_worker;
grant execute on function public.media_request_approve_with_retention(bigint, int, timestamptz, uuid, text, int)
    to service_role;

-- As in 20261017160516, except that the requester can't undo an admin's decision.
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
       or v_request.admin_retention is not null
       or v_request.remove_after_days is null
       or v_request.status not in ('wanted', 'searching', 'proposed', 'approved', 'downloading', 'available') then
        return 'changed';
    end if;
    update public.media_request set remove_after_days = null, remove_at = null where id = p_request_id;
    return 'kept';
end;
$$;
