import { supabase } from '@/integrations/supabase/client';

import type { Notification, Organization, OrganizationMember, WorkspaceInvitation } from '@/types/database';

import type {
  WorkspaceInvitationSummary,
  WorkspaceNotification,
  WorkspaceRole,
  WorkspaceSummary,
} from './workspace-context';

export const workspacesQueryKey = ['workspaces'] as const;

async function getCurrentUserId() {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sessao invalida.');
  return data.user.id;
}

export async function fetchWorkspacesState(): Promise<{
  invitations: WorkspaceInvitationSummary[];
  notifications: WorkspaceNotification[];
  workspaces: WorkspaceSummary[];
}> {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const userId = await getCurrentUserId();

  const [membershipsResult, organizationsResult, preferencesResult, invitationsResult, notificationsResult, profilesResult] =
    await Promise.all([
      supabase.from('organization_members').select('*').eq('user_id', userId).eq('is_active', true),
      supabase.from('organizations').select('*').is('deleted_at', null),
      supabase.from('workspace_user_preferences').select('*').eq('user_id', userId),
      supabase.from('workspace_invitations').select('*'),
      supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email'),
    ]);

  if (membershipsResult.error) throw membershipsResult.error;
  if (organizationsResult.error) throw organizationsResult.error;
  if (preferencesResult.error) throw preferencesResult.error;
  if (invitationsResult.error) throw invitationsResult.error;
  if (notificationsResult.error) throw notificationsResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const memberships = (membershipsResult.data ?? []) as OrganizationMember[];
  const organizations = (organizationsResult.data ?? []) as Organization[];
  const preferences = preferencesResult.data ?? [];
  const invitations = (invitationsResult.data ?? []) as WorkspaceInvitation[];
  const notifications = (notificationsResult.data ?? []) as Notification[];
  const profiles = profilesResult.data ?? [];

  const orgById = new Map(organizations.map((organization) => [organization.id, organization]));
  const preferenceById = new Map(preferences.map((item) => [item.organization_id, item]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const currentEmail = profiles.find((profile) => profile.id === userId)?.email.toLowerCase() ?? '';

  return {
    workspaces: memberships
      .map((membership) => {
        const workspace = orgById.get(membership.organization_id);
        if (!workspace) return null;
        return {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          timezone: workspace.timezone,
          iconFileId: workspace.icon_file_id,
          faviconFileId: workspace.favicon_file_id,
          userRole: membership.role as WorkspaceRole,
          lastAccessedAt: preferenceById.get(workspace.id)?.last_accessed_at ?? null,
        };
      })
      .filter((item): item is WorkspaceSummary => Boolean(item))
      .sort((first, second) => {
        const firstTime = first.lastAccessedAt ? new Date(first.lastAccessedAt).getTime() : 0;
        const secondTime = second.lastAccessedAt ? new Date(second.lastAccessedAt).getTime() : 0;
        return secondTime - firstTime || first.name.localeCompare(second.name, 'pt-BR');
      }),
    invitations: invitations
      .filter(
        (invitation) =>
          invitation.status === 'pending' &&
          (invitation.invited_user_id === userId ||
            invitation.invited_email.toLowerCase() === currentEmail),
      )
      .map((invitation) => ({
        id: invitation.id,
        organizationId: invitation.organization_id,
        workspaceName: orgById.get(invitation.organization_id)?.name ?? 'Workspace',
        workspaceSlug: orgById.get(invitation.organization_id)?.slug ?? 'workspace',
        invitedEmail: invitation.invited_email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expires_at,
        invitedByName: profileById.get(invitation.invited_by)?.full_name ?? null,
      })),
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      actionUrl: notification.action_url,
      readAt: notification.read_at,
      createdAt: notification.created_at,
      organizationId: notification.organization_id,
    })),
  };
}

export async function createWorkspace(values: { iconFileId?: string | null; name: string; slug: string }) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data, error } = await supabase.rpc('rpc_create_workspace', {
    p_name: values.name,
    p_slug: values.slug,
    p_icon_file_id: values.iconFileId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function acceptWorkspaceInvitation(invitationId: string) {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const { data, error } = await supabase.rpc('rpc_accept_workspace_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
  return data;
}

export async function declineWorkspaceInvitation(invitationId: string) {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const { data, error } = await supabase.rpc('rpc_decline_workspace_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
  return data;
}

export async function markNotificationAsRead(notificationId: string) {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function updateWorkspacePreference(organizationId: string) {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const userId = await getCurrentUserId();
  const timestamp = new Date().toISOString();
  const { error } = await supabase
    .from('workspace_user_preferences')
    .upsert({
      organization_id: organizationId,
      user_id: userId,
      last_accessed_at: timestamp,
      sidebar_collapsed: false,
    });
  if (error) throw error;

  await supabase.from('profiles').update({ last_workspace_id: organizationId }).eq('id', userId);
}

export async function inviteWorkspaceMember(values: {
  email: string;
  role: 'admin' | 'member' | 'viewer';
  workspaceId: string;
}) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data, error } = await supabase.functions.invoke('invite-workspace-member', {
    body: {
      workspaceId: values.workspaceId,
      email: values.email,
      role: values.role,
    },
  });
  if (error) throw error;
  return data;
}

export async function updateWorkspaceBranding(values: {
  iconFileId: string | null;
  name: string;
  workspaceId: string;
}) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const slug = values.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: values.name,
      slug,
      icon_file_id: values.iconFileId,
      favicon_file_id: values.iconFileId,
    })
    .eq('id', values.workspaceId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Organization;
}
