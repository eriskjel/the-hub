-- Profiles are read by signed-in users only. Every app reader is either a
-- signed-in user or the service role.
drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles
  for select to authenticated using (true);

revoke all on table public.profiles from anon;
