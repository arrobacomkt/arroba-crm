import { Files, Link2, Pin, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import type { ChatWorkspaceChannel } from './chat-queries';
import type { ChatDecoratedMessage } from './chat-workspace';

type ChannelDetailsPanelProps = {
  channel: ChatWorkspaceChannel;
  membersCount: number;
  messages: ChatDecoratedMessage[];
};

export function ChannelDetailsPanel({
  channel,
  membersCount,
  messages,
}: ChannelDetailsPanelProps) {
  const attachments = messages.flatMap((message) => message.attachments);
  const links = messages
    .map((message) => message.linkPreview)
    .filter((preview): preview is NonNullable<typeof preview> => Boolean(preview));

  return (
    <aside className="border-t border-border bg-card xl:border-l xl:border-t-0">
      <div className="space-y-6 p-5">
        <section>
          <Badge tone="brand">Detalhes do canal</Badge>
          <h2 className="mt-3 text-lg font-semibold">#{channel.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {channel.description || 'Canal sem descricao detalhada.'}
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <UsersRound size={16} className="text-brand" />
            <h3 className="font-medium">Contexto</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p>Cliente: {channel.accountName ?? 'Nao vinculado'}</p>
            <p>Projeto: {channel.projectTitle ?? 'Nao vinculado'}</p>
            <p>Membros visiveis: {membersCount}</p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Files size={16} className="text-brand" />
            <h3 className="font-medium">Arquivos</h3>
          </div>
          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.slice(0, 8).map((attachment) => (
                <a
                  key={attachment.id}
                  className="block rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
                  href={attachment.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {attachment.name}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum arquivo compartilhado nesse recorte.</p>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-brand" />
            <h3 className="font-medium">Links compartilhados</h3>
          </div>
          {links.length > 0 ? (
            <div className="space-y-2">
              {links.slice(0, 8).map((link) => (
                <a
                  key={`${link.url}-${link.domain}`}
                  className="block rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
                  href={link.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {link.title ?? link.domain}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum link detectado ainda.</p>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Pin size={16} className="text-brand" />
            <h3 className="font-medium">Painel futuro</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Esse espaco fica pronto para mensagens fixadas e indicadores extras depois da entrega do MVP.
          </p>
        </section>
      </div>
    </aside>
  );
}
