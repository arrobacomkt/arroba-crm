import { createContext, useContext } from 'react';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export type WorkspaceSummary = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  iconFileId: string | null;
  faviconFileId: string | null;
  userRole: WorkspaceRole;
  lastAccessedAt: string | null;
};

export type WorkspaceNotification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
  organizationId: string | null;
};

export type WorkspaceInvitationSummary = {
  id: string;
  organizationId: string;
  workspaceName: string;
  workspaceSlug: string;
  invitedEmail: string;
  role: WorkspaceRole;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  expiresAt: string;
  invitedByName: string | null;
};

export type WorkspaceContextValue = {
  currentRole: WorkspaceRole | null;
  currentWorkspace: WorkspaceSummary | null;
  invitations: WorkspaceInvitationSummary[];
  isLoading: boolean;
  isSwitchingWorkspace: boolean;
  notifications: WorkspaceNotification[];
  refreshWorkspaceState: () => Promise<void>;
  setCurrentWorkspaceBySlug: (slug: string) => Promise<void>;
  workspaces: WorkspaceSummary[];
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }
  return context;
}
