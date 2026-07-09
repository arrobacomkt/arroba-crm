create table public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  default_price numeric(12, 2) not null default 0 check (default_price >= 0),
  recurrence text not null check (recurrence in ('one_off', 'monthly')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create trigger service_catalog_set_updated_at
before update on public.service_catalog
for each row
execute function public.set_updated_at();

create table public.client_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  service_catalog_id uuid not null references public.service_catalog(id),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  contracted_price numeric(12, 2) not null check (contracted_price >= 0),
  recurrence text not null check (recurrence in ('one_off', 'monthly')),
  billing_day integer check (billing_day >= 1 and billing_day <= 31),
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint client_services_monthly_billing_day check (
    (recurrence = 'monthly' and billing_day is not null) or
    (recurrence = 'one_off')
  )
);

create trigger client_services_set_updated_at
before update on public.client_services
for each row
execute function public.set_updated_at();

create table public.client_service_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_service_id uuid not null references public.client_services(id) on delete cascade,
  account_unit_id uuid not null references public.account_units(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_service_id, account_unit_id)
);

create table public.billing_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  client_service_id uuid not null references public.client_services(id) on delete cascade,
  reference_month date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'late', 'exempt')),
  due_date date not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_service_id, reference_month)
);

create trigger billing_cycles_set_updated_at
before update on public.billing_cycles
for each row
execute function public.set_updated_at();

create or replace function public.assert_service_context_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_org_id uuid;
  catalog_org_id uuid;
  account_lifecycle text;
begin
  if tg_table_name = 'client_services' or tg_table_name = 'billing_cycles' then
    select organization_id, lifecycle_status into account_org_id, account_lifecycle
    from public.accounts where id = new.account_id;
    
    if account_org_id is null or account_org_id <> new.organization_id then
      raise exception 'account belongs to a different organization' using errcode = 'check_violation';
    end if;

    if tg_table_name = 'client_services' and account_lifecycle <> 'client' then
      raise exception 'account must be a client to have services' using errcode = 'check_violation';
    end if;
  end if;

  if tg_table_name = 'client_services' then
    select organization_id into catalog_org_id
    from public.service_catalog where id = new.service_catalog_id;
    
    if catalog_org_id is null or catalog_org_id <> new.organization_id then
      raise exception 'service catalog belongs to a different organization' using errcode = 'check_violation';
    end if;
  end if;

  if tg_table_name = 'client_service_units' then
    select organization_id into catalog_org_id
    from public.client_services where id = new.client_service_id;
    
    if catalog_org_id is null or catalog_org_id <> new.organization_id then
      raise exception 'client service belongs to a different organization' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger client_services_assert_same_org
before insert or update on public.client_services
for each row execute function public.assert_service_context_same_org();

create trigger client_service_units_assert_same_org
before insert or update on public.client_service_units
for each row execute function public.assert_service_context_same_org();

create trigger billing_cycles_assert_same_org
before insert or update on public.billing_cycles
for each row execute function public.assert_service_context_same_org();

create or replace function public.rpc_convert_opportunity_to_client(
  p_opportunity_id uuid,
  p_services jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opp record;
  v_stage_id uuid;
  v_service record;
  v_client_service_id uuid;
  v_unit_id uuid;
  v_ref_month date;
  v_due_date date;
begin
  select * into v_opp
  from public.opportunities
  where id = p_opportunity_id;

  if v_opp is null then
    raise exception 'opportunity not found';
  end if;

  if not public.is_org_member(v_opp.organization_id) then
    raise exception 'access denied';
  end if;

  if v_opp.converted_at is not null then
    raise exception 'opportunity already converted';
  end if;

  -- find won stage
  select id into v_stage_id
  from public.pipeline_stages
  where organization_id = v_opp.organization_id and stage_group = 'won'
  order by position asc
  limit 1;

  if v_stage_id is null then
    raise exception 'won pipeline stage not found';
  end if;

  -- convert account
  update public.accounts
  set 
    lifecycle_status = 'client',
    status = 'active'
  where id = v_opp.account_id;

  -- convert opportunity
  update public.opportunities
  set 
    pipeline_stage_id = v_stage_id,
    won_at = coalesce(won_at, now()),
    converted_at = now(),
    lost_at = null,
    lost_reason = null
  where id = p_opportunity_id;

  -- process services
  for v_service in select * from jsonb_to_recordset(p_services) as x(service_catalog_id uuid, contracted_price numeric, recurrence text, billing_day integer, account_unit_ids jsonb) loop
    insert into public.client_services (
      organization_id, account_id, service_catalog_id, contracted_price, recurrence, billing_day
    ) values (
      v_opp.organization_id, v_opp.account_id, v_service.service_catalog_id, v_service.contracted_price, v_service.recurrence, v_service.billing_day
    ) returning id into v_client_service_id;

    if v_service.account_unit_ids is not null then
      for v_unit_id in select * from jsonb_array_elements_text(v_service.account_unit_ids) loop
        insert into public.client_service_units (
          organization_id, client_service_id, account_unit_id
        ) values (
          v_opp.organization_id, v_client_service_id, v_unit_id::uuid
        );
      end loop;
    end if;

    -- create initial billing cycle
    if v_service.recurrence = 'monthly' then
      v_ref_month := date_trunc('month', now())::date;
      v_due_date := (date_trunc('month', now()) + ((v_service.billing_day - 1) || ' days')::interval)::date;
      if v_due_date < now()::date then
        v_due_date := (date_trunc('month', now() + interval '1 month') + ((v_service.billing_day - 1) || ' days')::interval)::date;
        v_ref_month := date_trunc('month', now() + interval '1 month')::date;
      end if;
    else
      v_ref_month := date_trunc('month', now())::date;
      v_due_date := now()::date;
    end if;

    insert into public.billing_cycles (
      organization_id, account_id, client_service_id, reference_month, amount, due_date
    ) values (
      v_opp.organization_id, v_opp.account_id, v_client_service_id, v_ref_month, v_service.contracted_price, v_due_date
    );
  end loop;
end;
$$;

create or replace function public.rpc_mark_billing_cycle_paid(
  p_billing_cycle_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle record;
begin
  select * into v_cycle
  from public.billing_cycles
  where id = p_billing_cycle_id;

  if v_cycle is null then
    raise exception 'billing cycle not found';
  end if;

  if not public.is_org_member(v_cycle.organization_id) then
    raise exception 'access denied';
  end if;

  update public.billing_cycles
  set 
    status = 'paid',
    paid_at = now()
  where id = p_billing_cycle_id;
end;
$$;

insert into public.service_catalog (organization_id, name, default_price, recurrence)
select id, catalog.name, catalog.default_price, catalog.recurrence
from public.organizations
cross join (
  values
    ('Plano Essencial', 1500.00, 'monthly'),
    ('Plano Profissional', 2500.00, 'monthly'),
    ('Plano Premium', 3500.00, 'monthly'),
    ('Unidade adicional', 500.00, 'monthly'),
    ('Bio Sprint', 800.00, 'one_off'),
    ('Identidade Visual Completa', 3000.00, 'one_off'),
    ('Gravação Avulsa', 600.00, 'one_off'),
    ('Automação WhatsApp', 1200.00, 'one_off')
) as catalog(name, default_price, recurrence)
where organizations.slug = 'arroba-co'
on conflict (organization_id, name) do nothing;

alter table public.service_catalog enable row level security;
alter table public.client_services enable row level security;
alter table public.client_service_units enable row level security;
alter table public.billing_cycles enable row level security;

create policy "members can read service catalog" on public.service_catalog for select to authenticated using (public.is_org_member(organization_id));
create policy "members can insert service catalog" on public.service_catalog for insert to authenticated with check (public.is_org_member(organization_id));
create policy "members can update service catalog" on public.service_catalog for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "members can read client services" on public.client_services for select to authenticated using (public.is_org_member(organization_id));
create policy "members can insert client services" on public.client_services for insert to authenticated with check (public.is_org_member(organization_id));
create policy "members can update client services" on public.client_services for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "members can read client service units" on public.client_service_units for select to authenticated using (public.is_org_member(organization_id));
create policy "members can insert client service units" on public.client_service_units for insert to authenticated with check (public.is_org_member(organization_id));
create policy "members can update client service units" on public.client_service_units for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "members can read billing cycles" on public.billing_cycles for select to authenticated using (public.is_org_member(organization_id));
create policy "members can insert billing cycles" on public.billing_cycles for insert to authenticated with check (public.is_org_member(organization_id));
create policy "members can update billing cycles" on public.billing_cycles for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
