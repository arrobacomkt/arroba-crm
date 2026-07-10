import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { WorkspaceInvitationSummary } from './workspace-context';

type PendingInvitationCardProps = {
  invitation: WorkspaceInvitationSummary;
  onAccept: (invitationId: string) => void;
  onDecline: (invitationId: string) => void;
};

export function PendingInvitationCard({
  invitation,
  onAccept,
  onDecline,
}: PendingInvitationCardProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{invitation.workspaceName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {invitation.invitedByName ?? 'Workspace'} convidou voce para entrar como {invitation.role}.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Expira em {new Date(invitation.expiresAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <Badge tone="warning">Pendente</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => onAccept(invitation.id)}>
          Aceitar
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDecline(invitation.id)}>
          Recusar
        </Button>
      </div>
    </article>
  );
}
