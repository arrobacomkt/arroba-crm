import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/features/auth/auth-context';

import { WorkspaceContext, type WorkspaceSummary } from './workspace-context';
import {
  loadLocalWorkspaceState,
  localWorkspaceOwnerId,
} from './workspace-data';
import { fetchWorkspacesState, updateWorkspacePreference, workspacesQueryKey } from './workspace-queries';
import { clearActiveWorkspace, readActiveWorkspaceSlug, writeActiveWorkspace } from './workspace-storage';

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { isSupabaseConfigured, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const queryClient = useQueryClient();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== localWorkspaceOwnerId;
  const [localVersion, setLocalVersion] = useState(0);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: fetchWorkspacesState,
    enabled: hasRealSession,
  });

  const localState = useMemo(
    () => loadLocalWorkspaceState(user?.id ?? localWorkspaceOwnerId),
    [localVersion, user?.id],
  );

  const state = hasRealSession
    ? workspaceQuery.data ?? { invitations: [], notifications: [], workspaces: [] }
    : localState;

  const currentWorkspace = useMemo<WorkspaceSummary | null>(() => {
    const slugFromRoute = params.workspaceSlug ?? null;
    if (slugFromRoute) {
      return state.workspaces.find((workspace) => workspace.slug === slugFromRoute) ?? null;
    }

    const rememberedSlug = readActiveWorkspaceSlug();
    if (rememberedSlug) {
      return state.workspaces.find((workspace) => workspace.slug === rememberedSlug) ?? null;
    }

    return state.workspaces[0] ?? null;
  }, [params.workspaceSlug, state.workspaces]);

  if (currentWorkspace) {
    writeActiveWorkspace({ id: currentWorkspace.id, slug: currentWorkspace.slug });
  }

  useEffect(() => {
    if (!currentWorkspace) {
      clearActiveWorkspace();
      return;
    }

    writeActiveWorkspace({ id: currentWorkspace.id, slug: currentWorkspace.slug });
    if (hasRealSession) {
      void updateWorkspacePreference(currentWorkspace.id);
    }
  }, [currentWorkspace?.id, currentWorkspace?.slug, hasRealSession]);

  useEffect(() => {
    const inWorkspaceRoute = location.pathname.startsWith('/w/');
    if (!inWorkspaceRoute) return;
    if (workspaceQuery.isLoading || workspaceQuery.isFetching || !user) return;

    if (!currentWorkspace) {
      navigate('/workspaces', { replace: true });
    }
  }, [
    currentWorkspace,
    location.pathname,
    navigate,
    user,
    workspaceQuery.isFetching,
    workspaceQuery.isLoading,
  ]);

  useEffect(() => {
    if (!isSwitchingWorkspace) return;
    const slugFromRoute = params.workspaceSlug ?? null;
    if (!slugFromRoute) {
      setIsSwitchingWorkspace(false);
      return;
    }

    if (currentWorkspace?.slug !== slugFromRoute) return;
    if (hasRealSession && workspaceQuery.isFetching) return;

    const frameId = window.requestAnimationFrame(() => {
      setIsSwitchingWorkspace(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    currentWorkspace?.slug,
    hasRealSession,
    isSwitchingWorkspace,
    params.workspaceSlug,
    workspaceQuery.isFetching,
  ]);

  const value = useMemo(
    () => ({
      currentRole: currentWorkspace?.userRole ?? null,
      currentWorkspace,
      invitations: state.invitations,
      isLoading: hasRealSession ? workspaceQuery.isLoading : false,
      isSwitchingWorkspace,
      notifications: state.notifications,
      refreshWorkspaceState: async () => {
        if (hasRealSession) {
          await queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
          await queryClient.refetchQueries({ queryKey: workspacesQueryKey });
          return;
        }

        setLocalVersion((value) => value + 1);
      },
      setCurrentWorkspaceBySlug: async (slug: string) => {
        const workspace = state.workspaces.find((item) => item.slug === slug);
        if (!workspace) return;
        setIsSwitchingWorkspace(true);
        writeActiveWorkspace({ id: workspace.id, slug: workspace.slug });
        if (hasRealSession) {
          queryClient.removeQueries({
            predicate: (query) => query.queryKey[0] !== workspacesQueryKey[0],
          });
          try {
            await updateWorkspacePreference(workspace.id);
          } catch (error) {
            setIsSwitchingWorkspace(false);
            throw error;
          }
          return;
        }

        setLocalVersion((value) => value + 1);
      },
      workspaces: state.workspaces,
    }),
    [
      currentWorkspace,
      hasRealSession,
      isSwitchingWorkspace,
      queryClient,
      state.invitations,
      state.notifications,
      state.workspaces,
      workspaceQuery.isLoading,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
