alter table public.organizations
add column if not exists icon_file_id uuid,
add column if not exists favicon_file_id uuid,
add column if not exists created_by uuid references public.profiles(id) on delete set null,
add column if not exists updated_at timestamptz not null default now(),
add column if not exists deleted_at timestamptz;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

alter table public.profiles
add column if not exists last_workspace_id uuid references public.organizations(id) on delete set null;

alter table public.organization_members
drop constraint if exists organization_members_role_check;

alter table public.organization_members
add constraint organization_members_role_check
check (role in ('owner', 'admin', 'member', 'viewer'));

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_email text not null,
  invited_user_id uuid references public.profiles(id) on delete set null,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'pending',
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('owner', 'admin', 'member', 'viewer')),
  check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired'))
);

drop trigger if exists workspace_invitations_set_updated_at on public.workspace_invitations;
create trigger workspace_invitations_set_updated_at
before update on public.workspace_invitations
for each row
execute function public.set_updated_at();

create unique index if not exists workspace_invite_unique_pending_email_idx
on public.workspace_invitations (organization_id, lower(invited_email))
where status = 'pending';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
on public.notifications (user_id, created_at desc);

create table if not exists public.workspace_user_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  last_accessed_at timestamptz not null default now(),
  sidebar_collapsed boolean not null default false,
  primary key (user_id, organization_id)
);

create or replace function public.is_workspace_owner(target_org_id uuid)
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

create or replace function public.is_workspace_admin(target_org_id uuid)
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
      and role in ('owner', 'admin')
      and is_active = true
  );
$$;

create or replace function public.can_invite_workspace_member(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_workspace_admin(target_org_id);
$$;

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

create or replace function public.rpc_accept_workspace_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.workspace_invitations;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select email into v_email from public.profiles where id = auth.uid();

  select *
  into v_invite
  from public.workspace_invitations
  where id = p_invitation_id;

  if v_invite.id is null then
    raise exception 'invitation not found';
  end if;

  if v_invite.status <> 'pending' or v_invite.expires_at < now() then
    raise exception 'invitation is no longer available';
  end if;

  if v_invite.invited_user_id is not null and v_invite.invited_user_id <> auth.uid() then
    raise exception 'invitation does not belong to current user';
  end if;

  if lower(v_invite.invited_email) <> lower(coalesce(v_email, '')) then
    raise exception 'invitation email does not match current user';
  end if;

  insert into public.organization_members (organization_id, user_id, role, is_active)
  values (v_invite.organization_id, auth.uid(), v_invite.role, true)
  on conflict (organization_id, user_id) do update
  set role = excluded.role, is_active = true;

  update public.workspace_invitations
  set status = 'accepted',
      accepted_at = now(),
      invited_user_id = auth.uid()
  where id = p_invitation_id;

  insert into public.notifications (
    user_id,
    organization_id,
    type,
    title,
    body,
    action_url
  )
  values (
    v_invite.invited_by,
    v_invite.organization_id,
    'workspace_invitation_accepted',
    'Convite aceito',
    coalesce(v_email, 'Um usuario') || ' aceitou o convite para o workspace.',
    '/workspaces'
  );

  return jsonb_build_object(
    'organizationId', v_invite.organization_id,
    'status', 'accepted'
  );
end;
$$;

create or replace function public.rpc_decline_workspace_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.workspace_invitations;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select email into v_email from public.profiles where id = auth.uid();

  select *
  into v_invite
  from public.workspace_invitations
  where id = p_invitation_id;

  if v_invite.id is null then
    raise exception 'invitation not found';
  end if;

  if v_invite.invited_user_id is not null and v_invite.invited_user_id <> auth.uid() then
    raise exception 'invitation does not belong to current user';
  end if;

  if lower(v_invite.invited_email) <> lower(coalesce(v_email, '')) then
    raise exception 'invitation email does not match current user';
  end if;

  update public.workspace_invitations
  set status = 'declined',
      declined_at = now(),
      invited_user_id = auth.uid()
  where id = p_invitation_id;

  insert into public.notifications (
    user_id,
    organization_id,
    type,
    title,
    body,
    action_url
  )
  values (
    v_invite.invited_by,
    v_invite.organization_id,
    'workspace_invitation_declined',
    'Convite recusado',
    coalesce(v_email, 'Um usuario') || ' recusou o convite para o workspace.',
    '/workspaces'
  );

  return jsonb_build_object(
    'organizationId', v_invite.organization_id,
    'status', 'declined'
  );
end;
$$;

alter table public.workspace_invitations enable row level security;
alter table public.notifications enable row level security;
alter table public.workspace_user_preferences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_invitations' and policyname = 'workspace members can read invitations'
  ) then
    create policy "workspace members can read invitations"
    on public.workspace_invitations
    for select
    to authenticated
    using (
      public.is_org_member(organization_id)
      or invited_user_id = auth.uid()
      or lower(invited_email) = lower(coalesce((select email from public.profiles where id = auth.uid()), ''))
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_invitations' and policyname = 'workspace admins can create invitations'
  ) then
    create policy "workspace admins can create invitations"
    on public.workspace_invitations
    for insert
    to authenticated
    with check (public.can_invite_workspace_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_invitations' and policyname = 'workspace admins can update invitations'
  ) then
    create policy "workspace admins can update invitations"
    on public.workspace_invitations
    for update
    to authenticated
    using (public.can_invite_workspace_member(organization_id))
    with check (public.can_invite_workspace_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'users read own notifications'
  ) then
    create policy "users read own notifications"
    on public.notifications
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'users update own notifications'
  ) then
    create policy "users update own notifications"
    on public.notifications
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_user_preferences' and policyname = 'users manage own workspace preferences'
  ) then
    create policy "users manage own workspace preferences"
    on public.workspace_user_preferences
    for all
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations' and policyname = 'authenticated users can create organizations'
  ) then
    create policy "authenticated users can create organizations"
    on public.organizations
    for insert
    to authenticated
    with check (auth.uid() is not null);
  end if;
end
$$;
