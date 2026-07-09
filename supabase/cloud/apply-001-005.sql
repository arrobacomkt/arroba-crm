-- Arroba Co CRM - apply migrations 001 to 005 in Supabase SQL Editor

-- ========================================
-- 001_extensions.sql
-- ========================================
create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ========================================
-- 002_organizations_profiles.sql
-- ========================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email, 'Usuário Arroba Co'),
    coalesce(new.email, '')
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

create trigger auth_users_create_profile
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.organizations (name, slug, timezone)
values ('Arroba Co', 'arroba-co', 'America/Sao_Paulo')
on conflict (slug) do nothing;

create index organization_members_user_id_idx
on public.organization_members (user_id)
where is_active = true;

create index organization_members_organization_id_idx
on public.organization_members (organization_id)
where is_active = true;

-- ========================================
-- 003_security_helpers.sql
-- ========================================
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

-- ========================================
-- 004_accounts_contacts_units.sql
-- ========================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lifecycle_status text not null default 'lead' check (lifecycle_status in ('lead', 'client')),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  display_name text not null,
  legal_name text,
  cnpj text,
  segment text,
  city text,
  state text,
  address text,
  instagram_url text,
  website_url text,
  lead_temperature text check (lead_temperature in ('hot', 'warm', 'cold')),
  lead_source text,
  owner_id uuid references public.profiles(id),
  strategic_notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger accounts_set_updated_at
before update on public.accounts
for each row
execute function public.set_updated_at();

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  full_name text not null,
  role_title text,
  phone text,
  whatsapp text,
  email text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contacts_set_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();

create table public.account_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  city text,
  state text,
  address text,
  instagram_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (account_id, name)
);

create or replace function public.assert_account_context_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_org_id uuid;
begin
  select organization_id
  into account_org_id
  from public.accounts
  where id = new.account_id
    and deleted_at is null;

  if account_org_id is null then
    raise exception 'account not found or archived'
      using errcode = 'foreign_key_violation';
  end if;

  if account_org_id <> new.organization_id then
    raise exception 'account belongs to a different organization'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger contacts_assert_same_org
before insert or update on public.contacts
for each row
execute function public.assert_account_context_same_org();

create trigger account_units_assert_same_org
before insert or update on public.account_units
for each row
execute function public.assert_account_context_same_org();

create unique index contacts_one_primary_per_account_idx
on public.contacts (account_id)
where is_primary = true;

create index accounts_org_lifecycle_idx
on public.accounts (organization_id, lifecycle_status)
where deleted_at is null;

create index accounts_org_status_idx
on public.accounts (organization_id, status)
where deleted_at is null;

create index accounts_display_name_trgm_idx
on public.accounts
using gin (display_name gin_trgm_ops);

create index contacts_account_idx
on public.contacts (account_id);

create index account_units_account_idx
on public.account_units (account_id);

alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.account_units enable row level security;

create policy "members can read accounts"
on public.accounts
for select
to authenticated
using (public.is_org_member(organization_id) and deleted_at is null);

create policy "members can insert accounts"
on public.accounts
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "members can update accounts"
on public.accounts
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "members can read contacts"
on public.contacts
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can insert contacts"
on public.contacts
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.accounts
    where accounts.id = contacts.account_id
      and accounts.organization_id = contacts.organization_id
      and accounts.deleted_at is null
  )
);

create policy "members can update contacts"
on public.contacts
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "members can read account units"
on public.account_units
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can insert account units"
on public.account_units
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.accounts
    where accounts.id = account_units.account_id
      and accounts.organization_id = account_units.organization_id
      and accounts.lifecycle_status = 'client'
      and accounts.deleted_at is null
  )
);

create policy "members can update account units"
on public.account_units
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- ========================================
-- 005_pipeline_opportunities.sql
-- ========================================
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  position integer not null,
  stage_group text not null check (stage_group in ('open', 'won', 'lost')),
  color_token text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, key),
  unique (organization_id, position)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  primary_contact_id uuid references public.contacts(id),
  pipeline_stage_id uuid not null references public.pipeline_stages(id),
  title text not null,
  estimated_value numeric(12, 2),
  expected_close_date date,
  proposal_valid_until date,
  owner_id uuid not null references public.profiles(id),
  next_follow_up_at timestamptz,
  lost_reason text,
  won_at timestamptz,
  lost_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_lost_reason_required check (
    lost_at is null
    or nullif(trim(lost_reason), '') is not null
  )
);

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row
execute function public.set_updated_at();

create table public.opportunity_line_items (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  service_catalog_id uuid,
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_value numeric(12, 2) not null check (unit_value >= 0),
  total_value numeric(12, 2) generated always as (quantity * unit_value) stored,
  recurrence text not null check (recurrence in ('one_off', 'monthly')),
  created_at timestamptz not null default now()
);

create or replace function public.assert_opportunity_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_org_id uuid;
  contact_account_id uuid;
  stage_org_id uuid;
begin
  select organization_id
  into account_org_id
  from public.accounts
  where id = new.account_id
    and deleted_at is null;

  if account_org_id is null then
    raise exception 'account not found or archived'
      using errcode = 'foreign_key_violation';
  end if;

  if account_org_id <> new.organization_id then
    raise exception 'opportunity account belongs to a different organization'
      using errcode = 'check_violation';
  end if;

  select organization_id
  into stage_org_id
  from public.pipeline_stages
  where id = new.pipeline_stage_id
    and is_active = true;

  if stage_org_id is null then
    raise exception 'pipeline stage not found or inactive'
      using errcode = 'foreign_key_violation';
  end if;

  if stage_org_id <> new.organization_id then
    raise exception 'pipeline stage belongs to a different organization'
      using errcode = 'check_violation';
  end if;

  if new.primary_contact_id is not null then
    select account_id
    into contact_account_id
    from public.contacts
    where id = new.primary_contact_id
      and organization_id = new.organization_id;

    if contact_account_id is null then
      raise exception 'primary contact not found in organization'
        using errcode = 'foreign_key_violation';
    end if;

    if contact_account_id <> new.account_id then
      raise exception 'primary contact does not belong to opportunity account'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger opportunities_assert_same_org
before insert or update on public.opportunities
for each row
execute function public.assert_opportunity_same_org();

create index pipeline_stages_org_position_idx
on public.pipeline_stages (organization_id, position)
where is_active = true;

create index opportunities_pipeline_idx
on public.opportunities (organization_id, pipeline_stage_id, next_follow_up_at);

create index opportunities_account_idx
on public.opportunities (account_id);

create index opportunity_line_items_opportunity_idx
on public.opportunity_line_items (opportunity_id);

alter table public.pipeline_stages enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_line_items enable row level security;

create policy "members can read pipeline stages"
on public.pipeline_stages
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "owners can manage pipeline stages"
on public.pipeline_stages
for all
to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create policy "members can read opportunities"
on public.opportunities
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can insert opportunities"
on public.opportunities
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.accounts
    where accounts.id = opportunities.account_id
      and accounts.organization_id = opportunities.organization_id
      and accounts.deleted_at is null
  )
);

create policy "members can update opportunities"
on public.opportunities
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "members can read opportunity line items"
on public.opportunity_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.opportunities
    where opportunities.id = opportunity_line_items.opportunity_id
      and public.is_org_member(opportunities.organization_id)
  )
);

create policy "members can insert opportunity line items"
on public.opportunity_line_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.opportunities
    where opportunities.id = opportunity_line_items.opportunity_id
      and public.is_org_member(opportunities.organization_id)
  )
);

create policy "members can update opportunity line items"
on public.opportunity_line_items
for update
to authenticated
using (
  exists (
    select 1
    from public.opportunities
    where opportunities.id = opportunity_line_items.opportunity_id
      and public.is_org_member(opportunities.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.opportunities
    where opportunities.id = opportunity_line_items.opportunity_id
      and public.is_org_member(opportunities.organization_id)
  )
);

insert into public.pipeline_stages (organization_id, key, name, position, stage_group, color_token)
select id, stage.key, stage.name, stage.position, stage.stage_group, stage.color_token
from public.organizations
cross join (
  values
    ('new_lead', 'Novo lead', 1, 'open', 'brand'),
    ('contact_started', 'Contato iniciado', 2, 'open', 'brand'),
    ('meeting_scheduled', 'Reunião agendada', 3, 'open', 'warning'),
    ('diagnosis_done', 'Diagnóstico realizado', 4, 'open', 'warning'),
    ('proposal_sent', 'Proposta enviada', 5, 'open', 'warning'),
    ('negotiation', 'Negociação', 6, 'open', 'warning'),
    ('won', 'Fechado ganho', 7, 'won', 'success'),
    ('lost', 'Fechado perdido', 8, 'lost', 'neutral')
) as stage(key, name, position, stage_group, color_token)
where organizations.slug = 'arroba-co'
on conflict (organization_id, key) do update
set
  name = excluded.name,
  position = excluded.position,
  stage_group = excluded.stage_group,
  color_token = excluded.color_token,
  is_active = true;

