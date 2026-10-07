-- Both views already run with the querying user's permissions in production
-- (set outside of migrations). Record it here so fresh databases match.
alter view public.countdown_provider_effective set (security_invoker = true);
alter view public.widgets_with_profiles set (security_invoker = true);
