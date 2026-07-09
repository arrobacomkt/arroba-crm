create or replace function public.current_org_ids()
returns uuid[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(organization_id), array[]::uuid[])
  from public.organization_members
  where user_id = auth.uid()
    and is_active = true;
$$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.is_org_owner(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
      and role = 'owner'
      and is_active = true
  );
$$;

create or replace function public.is_current_user(target_user_id uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() = target_user_id;
$$;

create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_owner_count integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' and old.is_active then
      select count(*)
      into remaining_owner_count
      from public.organization_members
      where organization_id = old.organization_id
        and user_id <> old.user_id
        and role = 'owner'
        and is_active = true;

      if remaining_owner_count = 0 then
        raise exception 'cannot remove the last active owner'
          using errcode = 'check_violation';
      end if;
    end if;

    return old;
  end if;

  if old.role = 'owner'
    and old.is_active
    and (new.role <> 'owner' or new.is_active = false)
  then
    select count(*)
    into remaining_owner_count
    from public.organization_members
    where organization_id = old.organization_id
      and user_id <> old.user_id
      and role = 'owner'
      and is_active = true;

    if remaining_owner_count = 0 then
      raise exception 'cannot remove the last active owner'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger organization_members_prevent_last_owner_update
before update on public.organization_members
for each row
execute function public.prevent_last_owner_removal();

create trigger organization_members_prevent_last_owner_delete
before delete on public.organization_members
for each row
execute function public.prevent_last_owner_removal();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;

create policy "members can read their organizations"
on public.organizations
for select
to authenticated
using (id = any(public.current_org_ids()));

create policy "owners can update their organizations"
on public.organizations
for update
to authenticated
using (public.is_org_owner(id))
with check (public.is_org_owner(id));

create policy "members can read profiles in their organizations"
on public.profiles
for select
to authenticated
using (
  public.is_current_user(id)
  or exists (
    select 1
    from public.organization_members member_profile
    where member_profile.user_id = profiles.id
      and member_profile.organization_id = any(public.current_org_ids())
      and member_profile.is_active = true
  )
);

create policy "users can update their own profile"
on public.profiles
for update
to authenticated
using (public.is_current_user(id))
with check (public.is_current_user(id));

create policy "members can read memberships in their organizations"
on public.organization_members
for select
to authenticated
using (organization_id = any(public.current_org_ids()));

create policy "owners can invite members"
on public.organization_members
for insert
to authenticated
with check (public.is_org_owner(organization_id));

create policy "owners can update memberships"
on public.organization_members
for update
to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));
