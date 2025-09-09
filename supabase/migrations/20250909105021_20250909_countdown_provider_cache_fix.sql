-- Extensions (safe)
create extension if not exists pgcrypto;

-- === Canonical table (single row per provider_id) ===
create table if not exists public.countdown_provider_cache (
  provider_id text primary key,                  -- 'trippel-trumf' | 'dnb-supertilbud'
  next_iso timestamptz null,
  previous_iso timestamptz null,
  tentative boolean not null default false,      -- prediction vs official
  confidence int not null default 0,             -- 0..100 (optional)
  source_url text null,
  fetched_at timestamptz not null default now(),
  valid_until timestamptz null,                  -- freshness window (optional)
  updated_by uuid null,                          -- admin user who last changed it

  -- admin override fields:
  manual_override_next_iso timestamptz null,
  manual_override_reason text null
);

-- Helpful index for querying upcoming/override dates
create index if not exists idx_cpc_next
  on public.countdown_provider_cache (coalesce(manual_override_next_iso, next_iso) nulls last);

-- Remove any accidental “latest” view we might have made earlier
drop view if exists public.countdown_cache_latest;

-- Effective view (what callers should read)
create or replace view public.countdown_provider_effective as
select
  provider_id,
  coalesce(manual_override_next_iso, next_iso) as effective_next_iso,
  previous_iso,
  tentative,
  confidence,
  source_url,
  fetched_at,
  valid_until,
  manual_override_next_iso,
  manual_override_reason
from public.countdown_provider_cache;

-- === RLS (tune to your needs) ===
alter table public.countdown_provider_cache enable row level security;

-- Allow any signed-in user to read (remove if you want backend-only reads)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='countdown_provider_cache'
      and policyname='cpc_read_auth'
  ) then
    create policy "cpc_read_auth"
      on public.countdown_provider_cache
      for select
      using (auth.uid() is not null);
  end if;
end $$;

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

-- Remove the old combined policy name if it slipped in earlier
drop policy if exists "cpc_write_service" on public.countdown_provider_cache;

-- INSERT policy (service role only)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='countdown_provider_cache'
      and policyname='cpc_insert_service'
  ) then
    create policy "cpc_insert_service"
      on public.countdown_provider_cache
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
      and tablename='countdown_provider_cache'
      and policyname='cpc_update_service'
  ) then
    create policy "cpc_update_service"
      on public.countdown_provider_cache
      for update
      using (public.is_service_role())
      with check (public.is_service_role());
  end if;
end $$;

-- === Optional: track who updated the row ===
-- This sets updated_by := auth.uid() whenever a signed-in user (or service role) writes.
create or replace function public.cpc_set_updated_by()
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
    where tgrelid = 'public.countdown_provider_cache'::regclass
      and tgname  = 'cpc_set_updated_by_trg'
  ) then
    create trigger cpc_set_updated_by_trg
    before insert or update on public.countdown_provider_cache
    for each row execute function public.cpc_set_updated_by();
  end if;
end $$;
