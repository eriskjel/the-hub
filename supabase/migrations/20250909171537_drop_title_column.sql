-- First drop the view that depends on title
drop view if exists public.widgets_with_profiles;

-- Now drop the column safely
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
    p.user_id as profile_user_id
from public.user_widgets uw
join public.profiles p on p.user_id = uw.user_id;
