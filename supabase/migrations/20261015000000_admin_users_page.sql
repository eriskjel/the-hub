-- Only the server's service role can read this directory. Never expose auth.users
-- as a view or return authentication secrets. Filtering and pagination share a snapshot.
create or replace function public.admin_users_page(
    p_page integer default 1, p_per_page integer default 10, p_query text default ''
)
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
    with input as (
        select greatest(1, coalesce(p_page, 1)) as requested_page,
               least(100, greatest(1, coalesce(p_per_page, 10))) as per_page,
               lower(left(trim(coalesce(p_query, '')), 100)) as query
    ), matches as materialized (
        select u.id, u.email, u.created_at, u.last_sign_in_at,
               u.raw_user_meta_data as user_metadata, u.raw_app_meta_data as app_metadata,
               p.username, p.full_name
        from auth.users u
        left join public.profiles p on p.id = u.id
        cross join input i
        where i.query = '' or exists (
            select 1 from unnest(array[
                u.email, p.username, p.full_name,
                u.raw_user_meta_data ->> 'preferred_username',
                u.raw_user_meta_data ->> 'user_name',
                u.raw_user_meta_data ->> 'full_name',
                u.raw_user_meta_data ->> 'name'
            ]) as value
            where strpos(lower(value), i.query) > 0
        )
    ), bounds as (
        select count(*) as total,
               least((select requested_page from input),
                   greatest(1, ceil(count(*)::numeric / (select per_page from input))::integer)) as page
        from matches
    ), page_rows as (
        select * from matches
        order by created_at desc nulls last, id
        limit (select per_page from input)
        offset (select (b.page::bigint - 1) * i.per_page from bounds b cross join input i)
    )
    select jsonb_build_object(
        'total', b.total, 'page', b.page,
        'users', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', u.id, 'email', u.email, 'username', u.username, 'full_name', u.full_name,
                'user_metadata', u.user_metadata, 'app_metadata', u.app_metadata,
                'last_sign_in_at', u.last_sign_in_at,
                'has_access', m.user_id is not null and m.revoked_at is null,
                'library_account', case when m.revoked_at is null then m.library_account end
            ) order by u.created_at desc nulls last, u.id)
            from page_rows u left join public.media_member m on m.user_id = u.id
        ), '[]'::jsonb)
    ) from bounds b;
$$;

revoke all on function public.admin_users_page(integer, integer, text) from public, anon, authenticated, media_worker;
grant execute on function public.admin_users_page(integer, integer, text) to service_role;
