-- Admin-managed list of countdown candidate dates rejected as incorrect.
-- The resolver skips these when picking the next date, so a wrong reported
-- date can be denied and the system falls back to the next candidate.
create table if not exists public.countdown_denied_dates (
    provider_id  text        not null,
    denied_date  date        not null,
    reason       text        null,
    denied_by    uuid        null,
    denied_at    timestamptz not null default now(),
    primary key (provider_id, denied_date)
);

alter table public.countdown_denied_dates enable row level security;

-- Read: any authenticated user (mirrors countdown_provider_cache policy).
drop policy if exists cdd_read on public.countdown_denied_dates;
create policy cdd_read on public.countdown_denied_dates
    for select to authenticated using (true);

-- Write: service role only; admin controller uses backend service role.
drop policy if exists cdd_write on public.countdown_denied_dates;
create policy cdd_write on public.countdown_denied_dates
    for all to service_role using (true) with check (true);

-- Auto-fill denied_by = auth.uid() on insert/update when available.
create or replace function public.cdd_set_denied_by() returns trigger
language plpgsql as $$
begin
    if new.denied_by is null then
        new.denied_by := auth.uid();
    end if;
    return new;
end $$;

drop trigger if exists cdd_set_denied_by_trg on public.countdown_denied_dates;
create trigger cdd_set_denied_by_trg
    before insert or update on public.countdown_denied_dates
    for each row execute function public.cdd_set_denied_by();

-- Invalidate any cached "next_iso" so the resolver re-picks after a deny change.
-- We just clear the cache table; it's small and refills on the next read.
truncate public.countdown_provider_cache;
