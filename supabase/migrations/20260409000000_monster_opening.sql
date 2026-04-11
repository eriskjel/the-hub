-- Extensions (safe — other migrations also install this)
create extension if not exists pgcrypto;

-- Monster case opening history
-- References profiles(id) only — profiles already references auth.users(id),
-- and this FK enables Supabase PostgREST joins for the live feed.
create table if not exists public.monster_opening (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_type text not null,        -- 'monster' | 'redbullBurn'
  item text not null,             -- variant name e.g. 'Mango Loco'
  rarity text not null,           -- 'blue' | 'purple' | 'pink' | 'red' | 'yellow'
  opened_at timestamptz not null default now()
);

-- Indexes for stats queries.
-- Note: no standalone (user_id) index — idx_mo_user_case already covers
-- user_id-only lookups on its leading column.
create index if not exists idx_mo_user_case on public.monster_opening (user_id, case_type);
create index if not exists idx_mo_opened_at on public.monster_opening (opened_at desc);
-- Rate-limit check (last opening for a user) + stats-by-case queries.
create index if not exists idx_mo_case_opened_at
  on public.monster_opening (case_type, opened_at desc);

-- Constraint: only valid rarity values
do $$ begin
  alter table public.monster_opening
    add constraint mo_rarity_check
    check (rarity in ('blue', 'purple', 'pink', 'red', 'yellow'));
exception when duplicate_object then null;
end $$;

-- Constraint: only valid case types
do $$ begin
  alter table public.monster_opening
    add constraint mo_case_type_check
    check (case_type in ('monster', 'redbullBurn'));
exception when duplicate_object then null;
end $$;

-- === RLS ===
alter table public.monster_opening enable row level security;

-- Any signed-in user can read all openings (needed for global feed/stats)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='monster_opening'
      and policyname='mo_read_auth'
  ) then
    create policy "mo_read_auth"
      on public.monster_opening
      for select
      using (auth.uid() is not null);
  end if;
end $$;

-- Users can only insert their own openings
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='monster_opening'
      and policyname='mo_insert_own'
  ) then
    create policy "mo_insert_own"
      on public.monster_opening
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

-- === Stats aggregation view ===
-- Pre-aggregated rarity counts per user per case. Avoids pulling the full
-- table into Node for /api/monster/stats. The view inherits RLS from the
-- underlying table, so an authenticated user can read any row (mirrors
-- mo_read_auth). If we ever tighten the read policy, the view follows.
create or replace view public.monster_opening_stats
with (security_invoker = true) as
select
  user_id,
  case_type,
  rarity,
  count(*)::int as count
from public.monster_opening
group by user_id, case_type, rarity;

comment on view public.monster_opening_stats is
  'Pre-aggregated rarity counts. Read via PostgREST; RLS inherited from monster_opening.';
