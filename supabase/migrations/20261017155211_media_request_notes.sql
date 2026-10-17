-- A note on a request ("the extended cut, please"), from someone who wants it.
-- Only its author and admins read it. The worker never sees the text, only
-- that a note exists, which tells it to leave the request to an admin.
-- A note lasts as long as its author wants the request: cancelling or taking
-- back a +1 removes it.
create table if not exists public.media_request_note (
    request_id  bigint      not null references public.media_request(id) on delete cascade,
    user_id     uuid        not null references public.profiles(id) on delete cascade,
    note        text        not null,
    created_at  timestamptz not null default now(),
    primary key (request_id, user_id),
    constraint mrn_note_length check (char_length(note) between 1 and 500)
);

create index if not exists mrn_user_idx on public.media_request_note (user_id);

revoke all on public.media_request_note from anon, authenticated;
grant select on public.media_request_note to authenticated;
alter table public.media_request_note enable row level security;

drop policy if exists mrn_read_own on public.media_request_note;
create policy mrn_read_own on public.media_request_note
    for select to authenticated
    using (user_id = (select auth.uid()) and (select public.is_media_member()));

create or replace function public.media_request_has_note(p_request_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (select 1 from public.media_request_note where request_id = p_request_id);
$$;

revoke all on function public.media_request_has_note(bigint) from public, anon, authenticated;
grant execute on function public.media_request_has_note(bigint) to media_worker;

-- As in 20261017101024, plus the note. A blank note is no note. It is saved
-- only when the call adds the user to the request.
drop function if exists public.media_request_add(uuid, text, int, int);
create or replace function public.media_request_add(
    p_user uuid, p_media_type text, p_tmdb_id int, p_weekly_quota int, p_note text default null
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

        if found and v_request.status <> 'cancelled' then
            if v_request.status = 'available' then return 'available'; end if;
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
                   next_check_at = now(), created_at = now(), fulfilled_at = null
             where id = v_request.id;
            delete from public.media_request_follower
             where request_id = v_request.id and user_id = p_user;
            v_id := v_request.id;
            v_outcome := 'reopened';
            exit;
        end if;

        insert into public.media_request (media_type, tmdb_id, requested_by)
        values (p_media_type, p_tmdb_id, p_user)
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

revoke all on function public.media_request_add(uuid, text, int, int, text) from public, anon, authenticated, media_worker;
grant execute on function public.media_request_add(uuid, text, int, int, text) to service_role;

-- As in 20261017101024; the requester's note goes with them.
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
    delete from public.media_request_note where request_id = p_request_id and user_id = p_user;

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

-- As in 20261013191028; the +1's note goes with it.
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
    if not found then return 'changed'; end if;
    delete from public.media_request_note where request_id = p_request_id and user_id = p_user;
    return 'unfollowed';
end;
$$;
