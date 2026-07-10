import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type PendingWorkspaceInviteItemProps = {
  expiresAt: string;
  invitedByName: string | null;
  role: string;
  workspaceName: string;
  onAccept: () => void;
  onDecline: () => void;
};

export function PendingWorkspaceInviteItem({
  expiresAt,
  invitedByName,
  role,
  workspaceName,
  onAccept,
  onDecline,
}: PendingWorkspaceInviteItemProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{workspaceName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {invitedByName ?? 'Workspace'} convidou voce como {role}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Expira em {new Date(expiresAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <Badge tone="warning">Pendente</Badge>
      </div>

      <div className="mt-3 flex gap-2">
        <Button className="flex-1" type="button" variant="secondary" onClick={onAccept}>
          Aceitar
        </Button>
        <Button className="flex-1" type="button" variant="ghost" onClick={onDecline}>
          Recusar
        </Button>
      </div>
    </article>
  );
}
