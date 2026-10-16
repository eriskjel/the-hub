-- Before the worker adds a title it checks that someone who wants it still has
-- access: the requester or a follower, with an active membership or the admin
-- role. The worker can't read auth.users, so it gets this one answer per
-- request instead of access to media_request_has_access for any user.
create or replace function public.media_request_still_wanted(p_request_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.media_request r
         where r.id = p_request_id
           and (
               public.media_request_has_access(r.requested_by)
               or exists (
                   select 1 from public.media_request_follower f
                    where f.request_id = r.id
                      and public.media_request_has_access(f.user_id)
               )
           )
    );
$$;

revoke all on function public.media_request_still_wanted(bigint) from public, anon, authenticated;
grant execute on function public.media_request_still_wanted(bigint) to media_worker;
