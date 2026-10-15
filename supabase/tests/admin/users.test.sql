\set ON_ERROR_STOP 1
\echo '== admin directory: access, filtering, pagination and projection'
begin;
do $$ declare denied text; begin
    foreach denied in array array['anon', 'authenticated', 'media_worker'] loop
        assert not has_function_privilege(denied, 'public.admin_users_page(integer,integer,text)', 'EXECUTE');
    end loop;
    assert has_function_privilege('service_role', 'public.admin_users_page(integer,integer,text)', 'EXECUTE');
end $$;

insert into auth.users (id, email, created_at, raw_user_meta_data, raw_app_meta_data, encrypted_password)
select md5('directory-fixture-' || i)::uuid,
       'directory-fixture-' || i || '@example.test',
       '2026-01-01'::timestamptz + i * interval '1 second',
       case when i = 104 then '{"preferred_username":"ProviderAlias"}'::jsonb else '{}'::jsonb end,
       '{"roles":["user"]}'::jsonb, 'must-not-be-returned'
from generate_series(1, 105) i;
update public.profiles set full_name = 'Unique Profile Name' where id = md5('directory-fixture-103')::uuid;
update public.profiles set username = 'unique_handle' where id = md5('directory-fixture-102')::uuid;
insert into public.media_member (user_id, library_account, weekly_quota)
values (md5('directory-fixture-105')::uuid, 'directory-account', 5);

set local role service_role;
do $$ declare r jsonb; begin
    r := public.admin_users_page(2, 5, ' DIRECTORY-FIXTURE- ');
    assert (r->>'total')::integer = 105, 'filter before pagination';
    assert (r->>'page')::integer = 2;
    assert jsonb_array_length(r->'users') = 5;
    assert r->'users'->0->>'id' = md5('directory-fixture-100')::uuid::text, 'stable newest-first ordering';
    assert not (r->'users'->0 ? 'encrypted_password'), 'never expose auth secrets';

    assert (public.admin_users_page(1, 5, 'provideralias')->>'total')::integer = 1;
    assert (public.admin_users_page(1, 5, 'unique profile')->>'total')::integer = 1;
    assert (public.admin_users_page(1, 5, 'unique_handle')->>'total')::integer = 1;
    assert (public.admin_users_page(1, 5, '%')->>'total')::integer = 0, 'search metacharacters are literal';
    r := public.admin_users_page(999, 5, 'directory-fixture-');
    assert (r->>'page')::integer = 21, 'clamp out-of-range pages';
    r := public.admin_users_page(999, 5, 'absent-directory-user');
    assert r = '{"page":1,"total":0,"users":[]}'::jsonb;

    r := public.admin_users_page(1, 10, 'directory-fixture-105@');
    assert (r->'users'->0->>'has_access')::boolean;
    assert r->'users'->0->>'library_account' = 'directory-account';
    update public.media_member set revoked_at = now() where user_id = md5('directory-fixture-105')::uuid;
    r := public.admin_users_page(1, 10, 'directory-fixture-105@');
    assert not (r->'users'->0->>'has_access')::boolean;
    assert r->'users'->0->>'library_account' is null;
    assert jsonb_array_length(public.admin_users_page(-1, 999, 'directory-fixture-')->'users') = 100;
end $$;
reset role;
do $$ begin
    assert (public.admin_users_page(999, 10, '')->>'total')::integer = (select count(*) from auth.users);
end $$;
rollback;
