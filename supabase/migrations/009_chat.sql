create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  scope text not null check (scope in ('general', 'commercial', 'operations', 'client')),
  account_id uuid references public.accounts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger chat_channels_set_updated_at
before update on public.chat_channels
for each row
execute function public.set_updated_at();

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger chat_messages_set_updated_at
before update on public.chat_messages
for each row
execute function public.set_updated_at();

create or replace function public.assert_chat_context_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_org_id uuid;
  project_org_id uuid;
  project_account_id uuid;
  channel_org_id uuid;
begin
  if tg_table_name = 'chat_channels' then
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
  end if;

  if tg_table_name = 'chat_messages' then
    select organization_id
    into channel_org_id
    from public.chat_channels
    where id = new.channel_id;

    if channel_org_id is null or channel_org_id <> new.organization_id then
      raise exception 'channel belongs to a different organization'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger chat_channels_assert_same_org
before insert or update on public.chat_channels
for each row
execute function public.assert_chat_context_same_org();

create trigger chat_messages_assert_same_org
before insert or update on public.chat_messages
for each row
execute function public.assert_chat_context_same_org();

create or replace function public.bump_chat_channel_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_channels
  set updated_at = now()
  where id = new.channel_id;

  return new;
end;
$$;

create trigger chat_messages_bump_channel_activity
after insert on public.chat_messages
for each row
execute function public.bump_chat_channel_activity();

create index chat_channels_org_updated_idx
on public.chat_channels (organization_id, updated_at desc);

create index chat_messages_channel_created_idx
on public.chat_messages (channel_id, created_at asc);

alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;

create policy "members can read chat channels"
on public.chat_channels
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can insert chat channels"
on public.chat_channels
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "members can update chat channels"
on public.chat_channels
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "members can read chat messages"
on public.chat_messages
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can insert chat messages"
on public.chat_messages
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "members can update chat messages"
on public.chat_messages
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
