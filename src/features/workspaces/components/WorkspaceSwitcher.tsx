import { useMutation } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/features/auth/auth-context';
import { localWorkspaceOwnerId, respondToLocalInvitation } from '@/features/workspaces/workspace-data';
import type { WorkspaceSummary } from '@/features/workspaces/workspace-context';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import {
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
} from '@/features/workspaces/workspace-queries';
import { buildWorkspaceInitials } from '@/features/workspaces/workspace-utils';

import { WorkspaceSwitcherButton } from './WorkspaceSwitcherButton';
import { WorkspaceSwitcherPopover } from './WorkspaceSwitcherPopover';

type WorkspaceSwitcherProps = {
  isCollapsed?: boolean;
  onNavigate?: () => void;
};

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getTargetWorkspacePath(pathname: string, currentSlug: string | undefined, nextSlug: string) {
  if (!currentSlug) {
    return `/w/${nextSlug}/dashboard`;
  }

  if (!pathname.startsWith(`/w/${currentSlug}`)) {
    return `/w/${nextSlug}/dashboard`;
  }

  const suffix = pathname.slice(`/w/${currentSlug}`.length);
  return `/w/${nextSlug}${suffix || '/dashboard'}`;
}

export function WorkspaceSwitcher({ isCollapsed = false, onNavigate }: WorkspaceSwitcherProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isSupabaseConfigured } = useAuth();
  const {
    currentWorkspace,
    invitations,
    refreshWorkspaceState,
    setCurrentWorkspaceBySlug,
    workspaces,
  } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== localWorkspaceOwnerId;

  const acceptInvitationMutation = useMutation({
    mutationFn: acceptWorkspaceInvitation,
    onSuccess: async () => {
      await refreshWorkspaceState();
    },
  });

  const declineInvitationMutation = useMutation({
    mutationFn: declineWorkspaceInvitation,
    onSuccess: async () => {
      await refreshWorkspaceState();
    },
  });

  const filteredWorkspaces = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(search);
    const sorted = [...workspaces].sort((first, second) => {
      if (first.id === currentWorkspace?.id) return -1;
      if (second.id === currentWorkspace?.id) return 1;

      const firstTime = first.lastAccessedAt ? new Date(first.lastAccessedAt).getTime() : 0;
      const secondTime = second.lastAccessedAt ? new Date(second.lastAccessedAt).getTime() : 0;
      return secondTime - firstTime || first.name.localeCompare(second.name, 'pt-BR');
    });

    if (!normalizedSearch) {
      return sorted;
    }

    return sorted.filter((workspace) => {
      const haystack = normalizeSearchValue([workspace.name, workspace.slug, workspace.timezone].join(' '));
      return haystack.includes(normalizedSearch);
    });
  }, [currentWorkspace?.id, search, workspaces]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    searchRef.current?.focus();
    setFocusedIndex(0);
  }, [isOpen]);

  useEffect(() => {
    setSearch('');
    setIsOpen(false);
  }, [location.pathname]);

  function workspaceIcon(workspace: WorkspaceSummary) {
    if (workspace.iconFileId) {
      return (
        <img
          alt={workspace.name}
          className="h-full w-full object-cover"
          src={workspace.iconFileId}
        />
      );
    }

    if (workspace.name.trim()) {
      return buildWorkspaceInitials(workspace.name);
    }

    return <Building2 size={18} />;
  }

  async function handleSelectWorkspace(workspace: WorkspaceSummary) {
    if (workspace.slug === currentWorkspace?.slug) {
      setIsOpen(false);
      return;
    }

    try {
      await setCurrentWorkspaceBySlug(workspace.slug);
      const targetPath = getTargetWorkspacePath(location.pathname, currentWorkspace?.slug, workspace.slug);
      setIsOpen(false);
      onNavigate?.();
      navigate(targetPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel trocar de workspace.');
    }
  }

  async function handleAcceptInvitation(invitationId: string) {
    try {
      if (hasRealSession) {
        await acceptInvitationMutation.mutateAsync(invitationId);
      } else {
        respondToLocalInvitation(user?.id ?? localWorkspaceOwnerId, invitationId, 'accepted');
        await refreshWorkspaceState();
      }
      toast.success('Convite aceito.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel aceitar o convite.');
    }
  }

  async function handleDeclineInvitation(invitationId: string) {
    try {
      if (hasRealSession) {
        await declineInvitationMutation.mutateAsync(invitationId);
      } else {
        respondToLocalInvitation(user?.id ?? localWorkspaceOwnerId, invitationId, 'declined');
        await refreshWorkspaceState();
      }
      toast.success('Convite recusado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel recusar o convite.');
    }
  }

  function handleCreateWorkspace() {
    setIsOpen(false);
    onNavigate?.();
    navigate('/workspaces?create=1');
  }

  function handleListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!filteredWorkspaces.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((value) => Math.min(value + 1, filteredWorkspaces.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((value) => Math.max(value - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void handleSelectWorkspace(filteredWorkspaces[focusedIndex] ?? filteredWorkspaces[0]);
    }
  }

  useEffect(() => {
    const target = itemRefs.current[focusedIndex];
    target?.focus();
  }, [focusedIndex]);

  return (
    <div ref={containerRef} className="relative px-3 pt-3">
      <div onKeyDown={handleListKeyDown}>
        <WorkspaceSwitcherButton
          icon={currentWorkspace ? workspaceIcon(currentWorkspace) : <Building2 size={18} />}
          isCollapsed={isCollapsed}
          isOpen={isOpen}
          label={currentWorkspace?.name ?? 'Arroba CRM'}
          subtitle={currentWorkspace?.timezone ?? 'Workspace ativo'}
          onClick={() => setIsOpen((value) => !value)}
        />
      </div>

      {isOpen && !isCollapsed ? (
        <WorkspaceSwitcherPopover
          currentWorkspaceId={currentWorkspace?.id}
          focusedIndex={focusedIndex}
          invitations={invitations}
          itemRefs={itemRefs}
          onAcceptInvitation={(invitationId) => void handleAcceptInvitation(invitationId)}
          onClose={() => setIsOpen(false)}
          onCreateWorkspace={handleCreateWorkspace}
          onDeclineInvitation={(invitationId) => void handleDeclineInvitation(invitationId)}
          onSelectWorkspace={(workspace) => void handleSelectWorkspace(workspace)}
          search={search}
          searchRef={searchRef}
          setSearch={setSearch}
          workspaceIcon={workspaceIcon}
          workspaces={filteredWorkspaces}
        />
      ) : null}
    </div>
  );
}
