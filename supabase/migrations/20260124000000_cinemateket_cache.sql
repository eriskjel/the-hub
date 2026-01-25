-- Extensions (safe)
create extension if not exists pgcrypto;

-- === Canonical table (single row for cinemateket) ===
create table if not exists public.cinemateket_cache (
  id text primary key default 'cinemateket',  -- single row
  showings jsonb not null default '[]'::jsonb,  -- array of FilmShowingDto
  fetched_at timestamptz not null default now(),
  valid_until timestamptz null,                  -- freshness window (optional)
  updated_by uuid null                           -- admin user who last changed it
);

-- Index for querying by fetched_at (freshness checks)
create index if not exists idx_cinemateket_cache_fetched
  on public.cinemateket_cache (fetched_at);

-- === RLS (tune to your needs) ===
alter table public.cinemateket_cache enable row level security;

-- Backend-only access: only service role can read/write
-- Frontend users must go through the API which validates widget ownership

-- Drop old policy if it exists (from initial migration that allowed any authenticated user)
drop policy if exists "cc_read_auth" on public.cinemateket_cache;

-- is_service_role() function already exists from countdown migration, so we can reuse it
-- CREATE OR REPLACE is safe to run multiple times (idempotent)
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role',
    false
  );
$$;

-- SELECT policy (service role only)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='cinemateket_cache'
      and policyname='cc_select_service'
  ) then
    create policy "cc_select_service"
      on public.cinemateket_cache
      for select
      using (public.is_service_role());
  end if;
end $$;

-- INSERT policy (service role only)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='cinemateket_cache'
      and policyname='cc_insert_service'
  ) then
    create policy "cc_insert_service"
      on public.cinemateket_cache
      for insert
      with check (public.is_service_role());
  end if;
end $$;

-- UPDATE policy (service role only)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='cinemateket_cache'
      and policyname='cc_update_service'
  ) then
    create policy "cc_update_service"
      on public.cinemateket_cache
      for update
      using (public.is_service_role())
      with check (public.is_service_role());
  end if;
end $$;

-- === Optional: track who updated the row ===
-- This sets updated_by := auth.uid() whenever a signed-in user (or service role) writes.
create or replace function public.cc_set_updated_by()
returns trigger
language plpgsql
as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if claims ? 'sub' then
    new.updated_by := (claims->>'sub')::uuid;
  end if;
  new.fetched_at := coalesce(new.fetched_at, now()); -- keep fetched_at non-null
  return new;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.cinemateket_cache'::regclass
      and tgname  = 'cc_set_updated_by_trg'
  ) then
    create trigger cc_set_updated_by_trg
    before insert or update on public.cinemateket_cache
    for each row execute function public.cc_set_updated_by();
  end if;
end $$;
