alter table public.documents
add column if not exists parent_document_id uuid references public.documents(id) on delete set null,
add column if not exists icon text,
add column if not exists cover_file_id uuid,
add column if not exists position integer not null default 0,
add column if not exists is_pinned boolean not null default false,
add column if not exists last_opened_at timestamptz;

create or replace function public.assert_document_hierarchy_valid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_org_id uuid;
  cycle_found boolean;
begin
  if new.parent_document_id is null then
    return new;
  end if;

  if new.parent_document_id = new.id then
    raise exception 'document cannot be its own parent'
      using errcode = 'check_violation';
  end if;

  select organization_id
  into parent_org_id
  from public.documents
  where id = new.parent_document_id;

  if parent_org_id is null or parent_org_id <> new.organization_id then
    raise exception 'parent document belongs to a different organization'
      using errcode = 'check_violation';
  end if;

  with recursive ancestors as (
    select id, parent_document_id
    from public.documents
    where id = new.parent_document_id

    union all

    select documents.id, documents.parent_document_id
    from public.documents
    inner join ancestors on ancestors.parent_document_id = documents.id
  )
  select exists(select 1 from ancestors where id = new.id)
  into cycle_found;

  if cycle_found then
    raise exception 'document hierarchy cycle detected'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists documents_assert_hierarchy on public.documents;
create trigger documents_assert_hierarchy
before insert or update on public.documents
for each row
execute function public.assert_document_hierarchy_valid();

create table if not exists public.document_favorites (
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create table if not exists public.document_recent_views (
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create index if not exists documents_parent_idx
on public.documents(parent_document_id);

create index if not exists documents_position_idx
on public.documents(organization_id, parent_document_id, position);

create index if not exists document_recent_views_user_idx
on public.document_recent_views(user_id, viewed_at desc);

alter table public.document_favorites enable row level security;
alter table public.document_recent_views enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'document_favorites'
      and policyname = 'members can read document favorites'
  ) then
    create policy "members can read document favorites"
    on public.document_favorites
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.documents
        where documents.id = document_favorites.document_id
          and public.is_org_member(documents.organization_id)
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'document_favorites'
      and policyname = 'members can manage document favorites'
  ) then
    create policy "members can manage document favorites"
    on public.document_favorites
    for all
    to authenticated
    using (public.is_current_user(user_id))
    with check (public.is_current_user(user_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'document_recent_views'
      and policyname = 'members can read document recent views'
  ) then
    create policy "members can read document recent views"
    on public.document_recent_views
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.documents
        where documents.id = document_recent_views.document_id
          and public.is_org_member(documents.organization_id)
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'document_recent_views'
      and policyname = 'members can manage own document recent views'
  ) then
    create policy "members can manage own document recent views"
    on public.document_recent_views
    for all
    to authenticated
    using (public.is_current_user(user_id))
    with check (public.is_current_user(user_id));
  end if;
end
$$;

alter table public.chat_channels
add column if not exists position integer not null default 0,
add column if not exists last_message_at timestamptz,
add column if not exists icon text;

create table if not exists public.message_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  url text not null,
  domain text,
  title text,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists chat_channels_last_message_idx
on public.chat_channels(organization_id, scope, last_message_at desc);

create index if not exists message_links_message_idx
on public.message_links(message_id);

alter table public.message_links enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'message_links'
      and policyname = 'members can read message links'
  ) then
    create policy "members can read message links"
    on public.message_links
    for select
    to authenticated
    using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'message_links'
      and policyname = 'members can insert message links'
  ) then
    create policy "members can insert message links"
    on public.message_links
    for insert
    to authenticated
    with check (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'message_links'
      and policyname = 'members can update message links'
  ) then
    create policy "members can update message links"
    on public.message_links
    for update
    to authenticated
    using (public.is_org_member(organization_id))
    with check (public.is_org_member(organization_id));
  end if;
end
$$;
