-- Baseline: the schema that existed before the first migration in this folder.
-- These objects were created outside of migrations, so a fresh database needs
-- them before 20250909105021 runs. Already present in production; every
-- statement is safe to re-run.

-- === Extensions (installed in public, as in production) ===
create extension if not exists citext with schema public;
create extension if not exists pg_trgm with schema public;

-- === Functions ===
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Creates a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      -- common providers
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      -- GitHub handle is usually `user_name`
      new.raw_user_meta_data->>'user_name',
      -- keep `login` as a fallback just in case
      new.raw_user_meta_data->>'login',
      -- OIDC-ish fallback
      new.raw_user_meta_data->>'preferred_username',
      ''
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- === Tables ===
create table if not exists public.profiles (
  id uuid not null,
  username public.citext,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_username_key unique (username),
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade
);

create table if not exists public.user_widgets (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  settings jsonb not null default '{}'::jsonb,
  grid jsonb not null default '{}'::jsonb,
  instance_id uuid not null default gen_random_uuid(),
  query text generated always as (settings ->> 'query') stored,
  city text generated always as (nullif(settings ->> 'city', '')) stored,
  lat double precision generated always as ((settings ->> 'lat')::double precision) stored,
  lon double precision generated always as ((settings ->> 'lon')::double precision) stored,
  has_target boolean generated always as ((settings ? 'target') or (settings ? 'targets')) stored,
  constraint user_widgets_pkey primary key (id),
  constraint user_widgets_instance_unique unique (instance_id),
  constraint user_widgets_user_id_fkey foreign key (user_id) references auth.users(id)
);

create table if not exists public.pi_devices (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  token_hash text not null,
  created_at timestamptz default now(),
  constraint pi_devices_pkey primary key (id),
  constraint pi_devices_token_hash_key unique (token_hash),
  constraint pi_devices_user_id_fkey foreign key (user_id) references auth.users(id)
);

create table if not exists public.pi_metrics_latest (
  device_id uuid not null,
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  constraint pi_metrics_latest_pkey primary key (device_id),
  constraint pi_metrics_latest_device_id_fkey foreign key (device_id) references public.pi_devices(id) on delete cascade
);

-- === Indexes (as in production, overlapping ones included) ===
create index if not exists idx_user_widgets_user on public.user_widgets (user_id);
create index if not exists idx_user_widgets_user_kind on public.user_widgets (user_id, kind);
create index if not exists user_widgets_user_kind_idx on public.user_widgets (user_id, kind);
create index if not exists uw_user_kind_idx on public.user_widgets (user_id, kind);
create unique index if not exists user_widgets_user_kind_instance_unique
  on public.user_widgets (user_id, kind, instance_id);
create unique index if not exists ux_user_widgets_instance_id on public.user_widgets (instance_id);
create unique index if not exists uq_user_countdown_provider
  on public.user_widgets (user_id, lower(settings ->> 'provider'))
  where kind = 'countdown' and lower(settings ->> 'source') = 'provider';
create index if not exists uw_kind_idx on public.user_widgets (kind);
create index if not exists uw_city_idx on public.user_widgets (city);
create index if not exists uw_query_idx on public.user_widgets (query);
create index if not exists uw_query_trgm on public.user_widgets using gin (query public.gin_trgm_ops);
create index if not exists uw_lat_lon_idx on public.user_widgets (lat, lon);
create index if not exists uw_gd_city_partial on public.user_widgets (city)
  where kind = 'grocery-deals' and city is not null;
create index if not exists uw_gd_query_partial on public.user_widgets (query)
  where kind = 'grocery-deals' and query is not null;
create index if not exists uw_sp_has_target_partial on public.user_widgets (has_target)
  where kind = 'server-pings';

create index if not exists pi_devices_user_idx on public.pi_devices (user_id);
create index if not exists pid_user_idx on public.pi_devices (user_id);

-- === Triggers ===
create or replace trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- === RLS ===
alter table public.profiles enable row level security;
alter table public.user_widgets enable row level security;
alter table public.pi_devices enable row level security;
alter table public.pi_metrics_latest enable row level security;

drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles
  for select using (true);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists uw_owner_read on public.user_widgets;
create policy uw_owner_read on public.user_widgets
  for select using (auth.uid() = user_id);

drop policy if exists uw_owner_write on public.user_widgets;
create policy uw_owner_write on public.user_widgets
  for insert with check (auth.uid() = user_id);

drop policy if exists uw_owner_update on public.user_widgets;
create policy uw_owner_update on public.user_widgets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists uw_owner_delete on public.user_widgets;
create policy uw_owner_delete on public.user_widgets
  for delete using (auth.uid() = user_id);

drop policy if exists pid_owner_read on public.pi_devices;
create policy pid_owner_read on public.pi_devices
  for select using (auth.uid() = user_id);

drop policy if exists pid_owner_write on public.pi_devices;
create policy pid_owner_write on public.pi_devices
  for insert with check (auth.uid() = user_id);

drop policy if exists pid_owner_update on public.pi_devices;
create policy pid_owner_update on public.pi_devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pid_owner_delete on public.pi_devices;
create policy pid_owner_delete on public.pi_devices
  for delete using (auth.uid() = user_id);

drop policy if exists pim_owner_read on public.pi_metrics_latest;
create policy pim_owner_read on public.pi_metrics_latest
  for select using (
    exists (
      select 1 from public.pi_devices d
      where d.id = pi_metrics_latest.device_id
        and d.user_id = auth.uid()
    )
  );

-- === Grants ===
grant all on table public.profiles, public.user_widgets, public.pi_devices, public.pi_metrics_latest
  to anon, authenticated, service_role;

grant all on function public.tg_set_updated_at(), public.set_updated_at(), public.handle_new_user()
  to anon, authenticated, service_role;
