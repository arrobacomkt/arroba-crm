create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  doc_type text not null check (doc_type in ('briefing', 'script', 'report', 'note')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'archived')),
  body text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger documents_set_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

create or replace function public.assert_document_context_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_org_id uuid;
  project_org_id uuid;
  project_account_id uuid;
begin
  if new.account_id is not null then
    select organization_id
    into account_org_id
    from public.accounts
    where id = new.account_id
      and deleted_at is null;

    if account_org_id is null or account_org_id <> new.organization_id then
      raise exception 'account belongs to a different organization'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.project_id is not null then
    select organization_id, account_id
    into project_org_id, project_account_id
    from public.projects
    where id = new.project_id;

    if project_org_id is null or project_org_id <> new.organization_id then
      raise exception 'project belongs to a different organization'
        using errcode = 'check_violation';
    end if;

    if new.account_id is not null and project_account_id <> new.account_id then
      raise exception 'project does not belong to selected account'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger documents_assert_same_org
before insert or update on public.documents
for each row
execute function public.assert_document_context_same_org();

create index documents_org_updated_idx
on public.documents (organization_id, updated_at desc);

create index documents_account_idx
on public.documents (account_id);

create index documents_project_idx
on public.documents (project_id);

alter table public.documents enable row level security;

create policy "members can read documents"
on public.documents
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can insert documents"
on public.documents
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "members can update documents"
on public.documents
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
