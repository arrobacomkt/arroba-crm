-- Run after creating Davi and Richards in Authentication > Users.
-- Replace the two email values below with the exact emails used in Supabase Auth.

with target_users as (
  select id, email
  from public.profiles
  where email in (
    'DAVI_EMAIL_AQUI',
    'RICHARDS_EMAIL_AQUI'
  )
),
target_org as (
  select id
  from public.organizations
  where slug = 'arroba-co'
)
insert into public.organization_members (organization_id, user_id, role, is_active)
select target_org.id, target_users.id, 'owner', true
from target_org
cross join target_users
on conflict (organization_id, user_id) do update
set
  role = 'owner',
  is_active = true;

select
  profiles.id,
  profiles.full_name,
  profiles.email,
  organization_members.role,
  organization_members.is_active
from public.organization_members
join public.profiles on profiles.id = organization_members.user_id
join public.organizations on organizations.id = organization_members.organization_id
where organizations.slug = 'arroba-co'
order by profiles.full_name;
