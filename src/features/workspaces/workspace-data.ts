import type { Notification, Organization, OrganizationMember, Profile, WorkspaceInvitation } from '@/types/database';

import {
  buildWorkspaceInitials,
  slugifyWorkspaceName,
} from './workspace-utils';
import type {
  WorkspaceInvitationSummary,
  WorkspaceNotification,
  WorkspaceRole,
  WorkspaceSummary,
} from './workspace-context';

type LocalWorkspaceStore = {
  invitations: WorkspaceInvitation[];
  memberships: OrganizationMember[];
  notifications: Notification[];
  preferences: Array<{
    last_accessed_at: string;
    organization_id: string;
    sidebar_collapsed: boolean;
    user_id: string;
  }>;
  profiles: Profile[];
  workspaces: Organization[];
};

export const localWorkspaceOwnerId = 'local-richards';
const localStorageKey = 'arrobaco.workspaces.v1';

function nowIso() {
  return new Date().toISOString();
}

function createSeedStore(): LocalWorkspaceStore {
  const now = nowIso();

  const workspaces: Organization[] = [
    {
      id: 'org-arroba-local',
      name: 'Arroba Co',
      slug: 'arroba-co',
      timezone: 'America/Sao_Paulo',
      icon_file_id: null,
      favicon_file_id: null,
      created_by: localWorkspaceOwnerId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: 'org-demo-local',
      name: 'Agencia Demo',
      slug: 'agencia-demo',
      timezone: 'America/Sao_Paulo',
      icon_file_id: null,
      favicon_file_id: null,
      created_by: localWorkspaceOwnerId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ];

  const profiles: Profile[] = [
    {
      id: localWorkspaceOwnerId,
      full_name: 'Richards',
      email: 'richards@arrobaco.local',
      avatar_path: null,
      last_workspace_id: 'org-arroba-local',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'user-davi-local',
      full_name: 'Davi',
      email: 'davi@arrobaco.local',
      avatar_path: null,
      last_workspace_id: 'org-arroba-local',
      created_at: now,
      updated_at: now,
    },
  ];

  return {
    workspaces,
    profiles,
    memberships: [
      {
        organization_id: 'org-arroba-local',
        user_id: localWorkspaceOwnerId,
        role: 'owner',
        is_active: true,
        created_at: now,
      },
      {
        organization_id: 'org-demo-local',
        user_id: localWorkspaceOwnerId,
        role: 'admin',
        is_active: true,
        created_at: now,
      },
      {
        organization_id: 'org-arroba-local',
        user_id: 'user-davi-local',
        role: 'owner',
        is_active: true,
        created_at: now,
      },
    ],
    invitations: [
      {
        id: 'invite-demo-local',
        organization_id: 'org-demo-local',
        invited_email: 'richards@arrobaco.local',
        invited_user_id: localWorkspaceOwnerId,
        invited_by: 'user-davi-local',
        role: 'member',
        status: 'pending',
        token_hash: 'local-token',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        accepted_at: null,
        declined_at: null,
        revoked_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    notifications: [
      {
        id: 'notification-demo-local',
        user_id: localWorkspaceOwnerId,
        organization_id: 'org-demo-local',
        type: 'workspace_invitation_received',
        title: 'Novo convite de workspace',
        body: 'Davi convidou voce para entrar em Agencia Demo.',
        action_url: '/workspaces',
        metadata: {},
        read_at: null,
        created_at: now,
      },
    ],
    preferences: [
      {
        user_id: localWorkspaceOwnerId,
        organization_id: 'org-arroba-local',
        last_accessed_at: now,
        sidebar_collapsed: false,
      },
    ],
  };
}

function readStore(): LocalWorkspaceStore {
  if (typeof window === 'undefined') return createSeedStore();

  const raw = window.localStorage.getItem(localStorageKey);
  if (!raw) {
    const seed = createSeedStore();
    writeStore(seed);
    return seed;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalWorkspaceStore>;
    const seed = createSeedStore();
    const store = {
      invitations: Array.isArray(parsed.invitations) ? parsed.invitations : seed.invitations,
      memberships: Array.isArray(parsed.memberships) ? parsed.memberships : seed.memberships,
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : seed.notifications,
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : seed.preferences,
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : seed.profiles,
      workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : seed.workspaces,
    };
    writeStore(store);
    return store;
  } catch {
    const seed = createSeedStore();
    writeStore(seed);
    return seed;
  }
}

function writeStore(store: LocalWorkspaceStore) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(localStorageKey, JSON.stringify(store));
}

export function loadLocalWorkspaceState(userId: string) {
  const store = readStore();
  return buildWorkspaceStateFromStore(store, userId);
}

function buildWorkspaceStateFromStore(store: LocalWorkspaceStore, userId: string) {
  const workspaceById = new Map(store.workspaces.map((workspace) => [workspace.id, workspace]));
  const profileById = new Map(store.profiles.map((profile) => [profile.id, profile]));
  const preferenceByWorkspaceId = new Map(
    store.preferences
      .filter((preference) => preference.user_id === userId)
      .map((preference) => [preference.organization_id, preference]),
  );

  const workspaces: WorkspaceSummary[] = store.memberships
    .filter((membership) => membership.user_id === userId && membership.is_active)
    .map((membership) => {
      const workspace = workspaceById.get(membership.organization_id);
      if (!workspace) return null;
      return {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        timezone: workspace.timezone,
        iconFileId: workspace.icon_file_id,
        faviconFileId: workspace.favicon_file_id,
        userRole: membership.role as WorkspaceRole,
        lastAccessedAt: preferenceByWorkspaceId.get(workspace.id)?.last_accessed_at ?? null,
      };
    })
    .filter((workspace): workspace is WorkspaceSummary => Boolean(workspace))
    .sort((first, second) => {
      const firstTime = first.lastAccessedAt ? new Date(first.lastAccessedAt).getTime() : 0;
      const secondTime = second.lastAccessedAt ? new Date(second.lastAccessedAt).getTime() : 0;
      return secondTime - firstTime || first.name.localeCompare(second.name, 'pt-BR');
    });

  const invitations: WorkspaceInvitationSummary[] = store.invitations
    .filter(
      (invitation) =>
        invitation.status === 'pending' &&
        (invitation.invited_user_id === userId ||
          profileById.get(userId)?.email.toLowerCase() === invitation.invited_email.toLowerCase()),
    )
    .map((invitation) => {
      const workspace = workspaceById.get(invitation.organization_id);
      return {
        id: invitation.id,
        organizationId: invitation.organization_id,
        workspaceName: workspace?.name ?? 'Workspace',
        workspaceSlug: workspace?.slug ?? slugifyWorkspaceName(workspace?.name ?? 'workspace'),
        invitedEmail: invitation.invited_email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expires_at,
        invitedByName: profileById.get(invitation.invited_by)?.full_name ?? null,
      };
    });

  const notifications: WorkspaceNotification[] = store.notifications
    .filter((notification) => notification.user_id === userId)
    .sort(
      (first, second) =>
        new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
    )
    .map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      actionUrl: notification.action_url,
      readAt: notification.read_at,
      createdAt: notification.created_at,
      organizationId: notification.organization_id,
    }));

  return { invitations, notifications, workspaces };
}

export function createLocalWorkspace(
  userId: string,
  values: { iconFileId?: string | null; name: string; slug: string },
) {
  const store = readStore();
  const now = nowIso();
  const workspace: Organization = {
    id: crypto.randomUUID(),
    name: values.name,
    slug: values.slug,
    timezone: 'America/Sao_Paulo',
    icon_file_id: values.iconFileId ?? null,
    favicon_file_id: values.iconFileId ?? null,
    created_by: userId,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  store.workspaces.unshift(workspace);
  store.memberships.unshift({
    organization_id: workspace.id,
    user_id: userId,
    role: 'owner',
    is_active: true,
    created_at: now,
  });
  store.preferences.unshift({
    user_id: userId,
    organization_id: workspace.id,
    last_accessed_at: now,
    sidebar_collapsed: false,
  });

  writeStore(store);
  return workspace;
}

export function respondToLocalInvitation(
  userId: string,
  invitationId: string,
  decision: 'accepted' | 'declined',
) {
  const store = readStore();
  const invite = store.invitations.find((item) => item.id === invitationId);
  if (!invite) return null;

  invite.status = decision;
  invite.updated_at = nowIso();
  if (decision === 'accepted') {
    invite.accepted_at = nowIso();
    if (!store.memberships.some((item) => item.organization_id === invite.organization_id && item.user_id === userId)) {
      store.memberships.push({
        organization_id: invite.organization_id,
        user_id: userId,
        role: invite.role,
        is_active: true,
        created_at: nowIso(),
      });
    }
  } else {
    invite.declined_at = nowIso();
  }

  const profile = store.profiles.find((item) => item.id === userId);
  store.notifications.unshift({
    id: crypto.randomUUID(),
    user_id: invite.invited_by,
    organization_id: invite.organization_id,
    type: decision === 'accepted' ? 'workspace_invitation_accepted' : 'workspace_invitation_declined',
    title: decision === 'accepted' ? 'Convite aceito' : 'Convite recusado',
    body: `${profile?.full_name ?? 'Um usuario'} ${decision === 'accepted' ? 'aceitou' : 'recusou'} o convite para o workspace.`,
    action_url: '/workspaces',
    metadata: {},
    read_at: null,
    created_at: nowIso(),
  });

  writeStore(store);
  return invite;
}

export function markLocalNotificationAsRead(userId: string, notificationId: string) {
  const store = readStore();
  const notification = store.notifications.find(
    (item) => item.id === notificationId && item.user_id === userId,
  );
  if (!notification) return;
  notification.read_at = nowIso();
  writeStore(store);
}

export function inviteLocalWorkspaceMember(
  userId: string,
  values: { email: string; organizationId: string; role: WorkspaceRole },
) {
  const store = readStore();
  const email = values.email.trim().toLowerCase();
  const existingProfile = store.profiles.find((profile) => profile.email.toLowerCase() === email) ?? null;
  const workspace = store.workspaces.find((item) => item.id === values.organizationId);
  const sender = store.profiles.find((profile) => profile.id === userId);
  if (!workspace) throw new Error('Workspace nao encontrado.');

  const duplicate = store.invitations.find(
    (invite) =>
      invite.organization_id === values.organizationId &&
      invite.invited_email.toLowerCase() === email &&
      invite.status === 'pending',
  );
  if (duplicate) {
    throw new Error('Ja existe um convite pendente para este e-mail.');
  }

  const activeMember = store.memberships.find(
    (membership) =>
      membership.organization_id === values.organizationId &&
      membership.is_active &&
      existingProfile &&
      membership.user_id === existingProfile.id,
  );
  if (activeMember) {
    throw new Error('Esse usuario ja participa deste workspace.');
  }

  const now = nowIso();
  store.invitations.unshift({
    id: crypto.randomUUID(),
    organization_id: values.organizationId,
    invited_email: email,
    invited_user_id: existingProfile?.id ?? null,
    invited_by: userId,
    role: values.role,
    status: 'pending',
    token_hash: crypto.randomUUID(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: null,
    declined_at: null,
    revoked_at: null,
    created_at: now,
    updated_at: now,
  });

  if (existingProfile) {
    store.notifications.unshift({
      id: crypto.randomUUID(),
      user_id: existingProfile.id,
      organization_id: values.organizationId,
      type: 'workspace_invitation_received',
      title: 'Novo convite de workspace',
      body: `${sender?.full_name ?? 'Um usuario'} convidou voce para entrar em ${workspace.name}.`,
      action_url: '/workspaces',
      metadata: {},
      read_at: null,
      created_at: now,
    });
  }

  writeStore(store);
}

export function updateLocalWorkspaceBranding(
  workspaceId: string,
  values: { iconFileId: string | null; name: string },
) {
  const store = readStore();
  const workspace = store.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new Error('Workspace nao encontrado.');
  workspace.name = values.name.trim();
  workspace.slug = slugifyWorkspaceName(values.name);
  workspace.icon_file_id = values.iconFileId;
  workspace.favicon_file_id = values.iconFileId;
  workspace.updated_at = nowIso();
  writeStore(store);
  return workspace;
}

export function getWorkspaceVisual(workspace: WorkspaceSummary) {
  return {
    initials: buildWorkspaceInitials(workspace.name),
    iconUrl: workspace.iconFileId,
  };
}
