import { ArrowLeft, Plus } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WorkspaceInvitationSummary, WorkspaceSummary } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils/cn';

import { PendingWorkspaceInviteItem } from './PendingWorkspaceInviteItem';
import { WorkspaceListItem } from './WorkspaceListItem';
import { WorkspaceSearchInput } from './WorkspaceSearchInput';

type WorkspaceSwitcherPopoverProps = {
  currentWorkspaceId?: string;
  focusedIndex: number;
  invitations: WorkspaceInvitationSummary[];
  itemRefs: RefObject<Array<HTMLButtonElement | null>>;
  onAcceptInvitation: (invitationId: string) => void;
  onClose: () => void;
  onCreateWorkspace: () => void;
  onDeclineInvitation: (invitationId: string) => void;
  onSelectWorkspace: (workspace: WorkspaceSummary) => void;
  search: string;
  searchRef: RefObject<HTMLInputElement | null>;
  setSearch: (value: string) => void;
  workspaceIcon: (workspace: WorkspaceSummary) => ReactNode;
  workspaces: WorkspaceSummary[];
};

export function WorkspaceSwitcherPopover({
  currentWorkspaceId,
  focusedIndex,
  invitations,
  itemRefs,
  onAcceptInvitation,
  onClose,
  onCreateWorkspace,
  onDeclineInvitation,
  onSelectWorkspace,
  search,
  searchRef,
  setSearch,
  workspaceIcon,
  workspaces,
}: WorkspaceSwitcherPopoverProps) {
  return (
    <div
      className={cn(
        'absolute left-[calc(100%+0.75rem)] top-0 z-[70] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground opacity-100 shadow-2xl',
        'max-h-[min(80vh,720px)] backdrop-blur-none',
      )}
      role="dialog"
    >
      <div className="border-b border-border p-3">
        <WorkspaceSearchInput
          ref={searchRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="border-b border-border p-2">
        <Link
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          to="/workspaces"
          onClick={onClose}
        >
          <ArrowLeft size={16} />
          Ver todos os workspaces
        </Link>
      </div>

      <div className="max-h-[52vh] space-y-5 overflow-y-auto p-3">
        <section>
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Todos os workspaces
            </p>
            <Badge tone="neutral">{workspaces.length}</Badge>
          </div>

          {workspaces.length > 0 ? (
            <div className="space-y-1">
              {workspaces.map((workspace, index) => (
                <WorkspaceListItem
                  key={workspace.id}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  icon={workspaceIcon(workspace)}
                  isCurrent={workspace.id === currentWorkspaceId}
                  isFocused={focusedIndex === index}
                  subtitle={workspace.slug}
                  title={workspace.name}
                  onClick={() => onSelectWorkspace(workspace)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              Nenhum workspace encontrado.
            </p>
          )}
        </section>

        {invitations.length > 0 ? (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Convites pendentes
              </p>
              <Badge tone="warning">{invitations.length}</Badge>
            </div>
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <PendingWorkspaceInviteItem
                  key={invitation.id}
                  expiresAt={invitation.expiresAt}
                  invitedByName={invitation.invitedByName}
                  role={invitation.role}
                  workspaceName={invitation.workspaceName}
                  onAccept={() => onAcceptInvitation(invitation.id)}
                  onDecline={() => onDeclineInvitation(invitation.id)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="border-t border-border p-3">
        <Button className="w-full" type="button" variant="secondary" onClick={onCreateWorkspace}>
          <Plus size={16} />
          Criar novo workspace
        </Button>
      </div>
    </div>
  );
}
