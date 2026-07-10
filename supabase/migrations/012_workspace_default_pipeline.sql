create or replace function public.rpc_create_workspace(
  p_name text,
  p_slug text,
  p_icon_file_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.organizations (
    name,
    slug,
    timezone,
    icon_file_id,
    favicon_file_id,
    created_by
  )
  values (
    trim(p_name),
    lower(trim(p_slug)),
    'America/Sao_Paulo',
    p_icon_file_id,
    p_icon_file_id,
    auth.uid()
  )
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role, is_active)
  values (v_org.id, auth.uid(), 'owner', true)
  on conflict (organization_id, user_id) do update
  set role = 'owner', is_active = true;

  insert into public.workspace_user_preferences (organization_id, user_id)
  values (v_org.id, auth.uid())
  on conflict (user_id, organization_id) do update
  set last_accessed_at = now();

  insert into public.pipeline_stages (
    organization_id,
    key,
    name,
    position,
    stage_group,
    color_token,
    is_active
  )
  values
    (v_org.id, 'new_lead', 'Novo lead', 1, 'open', 'brand', true),
    (v_org.id, 'qualified', 'Qualificado', 2, 'open', 'warning', true),
    (v_org.id, 'proposal_sent', 'Proposta enviada', 3, 'open', 'brand', true),
    (v_org.id, 'negotiation', 'Negociacao', 4, 'open', 'warning', true),
    (v_org.id, 'won', 'Fechado ganho', 5, 'won', 'success', true),
    (v_org.id, 'lost', 'Fechado perdido', 6, 'lost', 'neutral', true)
  on conflict do nothing;

  update public.profiles
  set last_workspace_id = v_org.id
  where id = auth.uid();

  return jsonb_build_object(
    'id', v_org.id,
    'name', v_org.name,
    'slug', v_org.slug,
    'timezone', v_org.timezone
  );
end;
$$;

insert into public.pipeline_stages (
  organization_id,
  key,
  name,
  position,
  stage_group,
  color_token,
  is_active
)
select
  missing.organization_id,
  missing.key,
  missing.name,
  coalesce(existing.max_position, 0) + row_number() over (
    partition by missing.organization_id
    order by missing.default_position
  ),
  missing.stage_group,
  missing.color_token,
  true
from (
  select
    organizations.id as organization_id,
    defaults.key,
    defaults.name,
    defaults.position as default_position,
    defaults.stage_group,
    defaults.color_token
  from public.organizations
  cross join (
    values
      ('new_lead', 'Novo lead', 1, 'open', 'brand'),
      ('qualified', 'Qualificado', 2, 'open', 'warning'),
      ('proposal_sent', 'Proposta enviada', 3, 'open', 'brand'),
      ('negotiation', 'Negociacao', 4, 'open', 'warning'),
      ('won', 'Fechado ganho', 5, 'won', 'success'),
      ('lost', 'Fechado perdido', 6, 'lost', 'neutral')
  ) as defaults(key, name, position, stage_group, color_token)
  where not exists (
    select 1
    from public.pipeline_stages
    where pipeline_stages.organization_id = organizations.id
      and pipeline_stages.key = defaults.key
  )
) as missing
left join (
  select organization_id, max(position) as max_position
  from public.pipeline_stages
  group by organization_id
) as existing
  on existing.organization_id = missing.organization_id;
