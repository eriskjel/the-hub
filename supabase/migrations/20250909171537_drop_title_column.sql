-- Drop the old view that depends on title
drop view if exists public.widgets_with_profiles;

-- Drop the title column from user_widgets
alter table public.user_widgets drop column if exists title;

-- Recreate the view without title
create view public.widgets_with_profiles as
select
    uw.id,
    uw.instance_id,
    uw.kind,
    uw.grid,
    uw.settings,
    p.id as profile_id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.created_at,
    p.updated_at
from public.user_widgets uw
         join public.profiles p on p.id = uw.user_id;
