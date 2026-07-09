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
