create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  description text,
  project_type text not null check (project_type in ('onboarding', 'one_off', 'monthly')),
  status text not null default 'planned' check (status in ('planned', 'active', 'blocked', 'completed', 'archived')),
  owner_id uuid not null references public.profiles(id),
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assignee_id uuid references public.profiles(id),
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger project_tasks_set_updated_at
before update on public.project_tasks
for each row
execute function public.set_updated_at();

create or replace function public.assert_project_context_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_org_id uuid;
  account_lifecycle text;
  project_org_id uuid;
begin
  if tg_table_name = 'projects' then
    select organization_id, lifecycle_status
    into account_org_id, account_lifecycle
    from public.accounts
    where id = new.account_id
      and deleted_at is null;

    if account_org_id is null or account_org_id <> new.organization_id then
      raise exception 'account belongs to a different organization'
        using errcode = 'check_violation';
    end if;

    if account_lifecycle <> 'client' then
      raise exception 'account must be a client to have projects'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_table_name = 'project_tasks' then
    select organization_id
    into project_org_id
    from public.projects
    where id = new.project_id;

    if project_org_id is null or project_org_id <> new.organization_id then
      raise exception 'project belongs to a different organization'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger projects_assert_same_org
before insert or update on public.projects
for each row
execute function public.assert_project_context_same_org();

create trigger project_tasks_assert_same_org
before insert or update on public.project_tasks
for each row
execute function public.assert_project_context_same_org();

create index projects_org_status_idx
on public.projects (organization_id, status, updated_at desc);

create index projects_account_idx
on public.projects (account_id);

create index project_tasks_project_status_idx
on public.project_tasks (project_id, status, sort_order);

alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;

create policy "members can read projects"
on public.projects
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can insert projects"
on public.projects
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "members can update projects"
on public.projects
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "members can read project tasks"
on public.project_tasks
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can insert project tasks"
on public.project_tasks
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "members can update project tasks"
on public.project_tasks
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
