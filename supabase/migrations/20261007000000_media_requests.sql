-- Media requests: members search for a title and add it to a shared wishlist.
-- A separate worker process picks requests up and reports status back.
--
-- Access model:
--   * Only users with an active media_member row (granted by an admin) can
--     read the queue. Users never write directly: the app's request route and
--     admin actions use the service role, which bypasses RLS.
--   * The worker connects as media_worker. It can read the queue and update
--     status columns, nothing else.

-- === Members: an active row = may request ===
create table if not exists public.media_member (
    user_id          uuid        primary key references public.profiles(id) on delete cascade,
    library_account  text        null,      -- the member's media library account; null only for admins
    weekly_quota     int         not null default 5,
    granted_by       uuid        null references public.profiles(id) on delete set null,
    granted_at       timestamptz not null default now(),
    revoked_at       timestamptz null,      -- null = active
    constraint mm_library_account_format check (library_account ~ '^[A-Za-z0-9._-]{1,64}$'),
    constraint mm_weekly_quota_range check (weekly_quota between 0 and 50)
);

-- One membership per library account, case-insensitive.
create unique index if not exists mm_library_account_uq
    on public.media_member (lower(library_account));

-- === Requests: one row per title, shared by everyone who wants it ===
-- Only the TMDB id is stored. The app and the worker look titles, posters,
-- external ids and release dates up from TMDB, so nothing here goes stale.
create table if not exists public.media_request (
    id              bigint      generated always as identity primary key,
    media_type      text        not null,
    tmdb_id         int         not null,
    requested_by    uuid        not null references public.profiles(id) on delete cascade,
    status          text        not null default 'wanted',
    status_detail   text        null,      -- short note shown to members
    chosen_rank     int         null,      -- set by an admin when approving a proposed option
    attempts        int         not null default 0,
    claimed_at      timestamptz null,      -- worker lease
    next_check_at   timestamptz not null default now(),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    fulfilled_at    timestamptz null,
    constraint mr_media_type_check check (media_type in ('movie', 'tv')),
    constraint mr_status_check check (status in (
        'wanted', 'searching', 'proposed', 'approved', 'downloading',
        'available', 'failed', 'declined', 'cancelled')),
    constraint mr_tmdb_id_check check (tmdb_id > 0),
    constraint mr_status_detail_length check (char_length(status_detail) <= 300),
    constraint mr_chosen_rank_range check (chosen_rank between 1 and 3),
    constraint mr_attempts_nonneg check (attempts >= 0)
);

create unique index if not exists mr_title_uq
    on public.media_request (media_type, tmdb_id);
-- Worker: next due request.
create index if not exists mr_due_idx
    on public.media_request (next_check_at) where status = 'wanted';
-- Quota count and "my requests".
create index if not exists mr_requested_by_idx
    on public.media_request (requested_by, created_at desc);

create or replace function public.media_request_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists mr_touch_updated_at on public.media_request;
create trigger mr_touch_updated_at
    before update on public.media_request
    for each row execute function public.media_request_touch_updated_at();

-- === Followers: "+1" from members other than the requester ===
create table if not exists public.media_request_follower (
    request_id  bigint      not null references public.media_request(id) on delete cascade,
    user_id     uuid        not null references public.profiles(id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (request_id, user_id)
);

create index if not exists mrf_user_idx on public.media_request_follower (user_id);

-- === Options the worker proposes for admin review (labels only) ===
create table if not exists public.media_request_option (
    request_id  bigint      not null references public.media_request(id) on delete cascade,
    rank        int         not null,      -- 1 = the worker's pick
    label       text        not null,
    reason      text        null,
    created_at  timestamptz not null default now(),
    primary key (request_id, rank),
    constraint mro_rank_range check (rank between 1 and 3),
    constraint mro_label_length check (char_length(label) between 1 and 300),
    constraint mro_reason_length check (char_length(reason) <= 500)
);

-- === Worker status: a single row ===
create table if not exists public.media_worker_status (
    id           boolean     primary key default true,
    paused       boolean     not null default false,  -- set by admins; the worker only reads it
    mode         text        null,
    last_run_at  timestamptz null,
    detail       text        null,
    constraint mws_single_row check (id),
    constraint mws_mode_check check (mode in ('dry', 'review', 'auto')),
    constraint mws_detail_length check (char_length(detail) <= 300)
);

insert into public.media_worker_status (id) values (true) on conflict (id) do nothing;

-- === Membership check used by RLS ===
create or replace function public.is_media_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.media_member
        where user_id = auth.uid()
          and revoked_at is null
    );
$$;

revoke all on function public.is_media_member() from public, anon;
grant execute on function public.is_media_member() to authenticated;
revoke all on function public.media_request_touch_updated_at() from public, anon, authenticated;

-- === Privileges: read-only for signed-in users, nothing for anon ===
-- RLS narrows the rows; these grants make sure no write path exists even if a
-- policy is ever added by mistake.
revoke all on public.media_member,
              public.media_request,
              public.media_request_follower,
              public.media_request_option,
              public.media_worker_status
    from anon, authenticated;
revoke all on sequence public.media_request_id_seq from anon, authenticated;

grant select on public.media_member,
                public.media_request,
                public.media_request_follower,
                public.media_worker_status
    to authenticated;

-- === RLS ===
alter table public.media_member           enable row level security;
alter table public.media_request          enable row level security;
alter table public.media_request_follower enable row level security;
alter table public.media_request_option   enable row level security;
alter table public.media_worker_status    enable row level security;

-- Users see their own membership, active or not, so the app can explain why
-- access is missing.
drop policy if exists mm_read_own on public.media_member;
create policy mm_read_own on public.media_member
    for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists mr_read_members on public.media_request;
create policy mr_read_members on public.media_request
    for select to authenticated using ((select public.is_media_member()));

drop policy if exists mrf_read_members on public.media_request_follower;
create policy mrf_read_members on public.media_request_follower
    for select to authenticated using ((select public.is_media_member()));

drop policy if exists mws_read_members on public.media_worker_status;
create policy mws_read_members on public.media_worker_status
    for select to authenticated using ((select public.is_media_member()));

-- media_request_option has no policy for authenticated: admins read it
-- through the service role.

-- === Worker role ===
-- Created without login. Login and password are set by hand outside
-- migrations: alter role media_worker with login password '...';
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'media_worker') then
        create role media_worker nologin;
    end if;
end $$;

grant usage on schema public to media_worker;

grant select on public.media_request to media_worker;
grant update (status, status_detail, attempts, claimed_at, next_check_at, fulfilled_at)
    on public.media_request to media_worker;

-- Re-check at add time that the requester or a follower is still a member.
grant select (user_id, revoked_at) on public.media_member to media_worker;
grant select on public.media_request_follower to media_worker;

grant select, insert, delete on public.media_request_option to media_worker;

grant select on public.media_worker_status to media_worker;
grant update (mode, last_run_at, detail) on public.media_worker_status to media_worker;

drop policy if exists mr_worker_read on public.media_request;
create policy mr_worker_read on public.media_request
    for select to media_worker using (true);

drop policy if exists mr_worker_update on public.media_request;
create policy mr_worker_update on public.media_request
    for update to media_worker using (true) with check (true);

drop policy if exists mm_worker_read on public.media_member;
create policy mm_worker_read on public.media_member
    for select to media_worker using (true);

drop policy if exists mrf_worker_read on public.media_request_follower;
create policy mrf_worker_read on public.media_request_follower
    for select to media_worker using (true);

drop policy if exists mro_worker_all on public.media_request_option;
create policy mro_worker_all on public.media_request_option
    for all to media_worker using (true) with check (true);

drop policy if exists mws_worker_read on public.media_worker_status;
create policy mws_worker_read on public.media_worker_status
    for select to media_worker using (true);

drop policy if exists mws_worker_update on public.media_worker_status;
create policy mws_worker_update on public.media_worker_status
    for update to media_worker using (true) with check (true);
