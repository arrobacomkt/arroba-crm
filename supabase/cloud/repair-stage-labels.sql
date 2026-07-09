-- Run once if the initial Cloud SQL script created mojibake stage names.

update public.pipeline_stages
set name = stage.name
from (
  values
    ('meeting_scheduled', 'Reunião agendada'),
    ('diagnosis_done', 'Diagnóstico realizado'),
    ('negotiation', 'Negociação')
) as stage(key, name)
where pipeline_stages.key = stage.key
  and pipeline_stages.organization_id in (
    select id
    from public.organizations
    where slug = 'arroba-co'
  );

select key, name
from public.pipeline_stages
where organization_id in (
  select id
  from public.organizations
  where slug = 'arroba-co'
)
order by position;
