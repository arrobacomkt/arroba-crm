import { ArrowRight, Clock3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { WorkspaceSummary } from './workspace-context';
import { buildWorkspaceInitials } from './workspace-utils';

type WorkspaceCardProps = {
  onOpen: (workspace: WorkspaceSummary) => void;
  workspace: WorkspaceSummary;
};

export function WorkspaceCard({ onOpen, workspace }: WorkspaceCardProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/12 text-sm font-bold text-brand">
            {buildWorkspaceInitials(workspace.name)}
          </div>
          <div>
            <h3 className="font-semibold">{workspace.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{workspace.slug}</p>
          </div>
        </div>
        <Badge tone={workspace.userRole === 'owner' ? 'brand' : workspace.userRole === 'admin' ? 'success' : 'neutral'}>
          {workspace.userRole}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 size={14} />
        <span>
          {workspace.lastAccessedAt
            ? `Ultimo acesso em ${new Date(workspace.lastAccessedAt).toLocaleString('pt-BR')}`
            : 'Ainda sem ultimo acesso'}
        </span>
      </div>

      <Button className="mt-5 w-full" type="button" onClick={() => onOpen(workspace)}>
        Entrar
        <ArrowRight size={16} />
      </Button>
    </article>
  );
}
