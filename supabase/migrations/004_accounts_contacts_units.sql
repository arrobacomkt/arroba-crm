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
