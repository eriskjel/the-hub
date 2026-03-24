-- Add admin_confirmed flag to countdown_provider_cache.
-- This column is NOT reset by the regular upsert (only when next_iso changes),
-- so an admin confirmation survives cache refreshes for the same date.
alter table public.countdown_provider_cache
    add column if not exists admin_confirmed boolean not null default false;
