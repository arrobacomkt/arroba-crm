import { Download, Image as ImageIcon, Paperclip } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

import { LinkPreviewCard } from './link-preview-card';
import { groupMessagesByDay, type ChatDecoratedMessage } from './chat-workspace';

type MessageListProps = {
  currentUserId: string | null | undefined;
  messages: ChatDecoratedMessage[];
};

export function MessageList({ currentUserId, messages }: MessageListProps) {
  const groups = groupMessagesByDay(messages);

  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
        Esse canal ainda esta vazio. A primeira mensagem pode nascer daqui.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.dateLabel} className="space-y-4">
          <div className="sticky top-0 z-10 flex justify-center">
            <Badge tone="neutral">{group.dateLabel}</Badge>
          </div>

          <div className="space-y-3">
            {group.items.map((message, index) => {
              const previous = group.items[index - 1];
              const isSameAuthor = previous?.author_id === message.author_id;
              const isCurrentUser = currentUserId === message.author_id;

              return (
                <article
                  key={message.id}
                  className={cn('flex', isCurrentUser ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[92%] rounded-2xl border px-4 py-3 md:max-w-[78%]',
                      isCurrentUser ? 'border-brand/30 bg-brand/8' : 'border-border bg-card',
                    )}
                  >
                    {!isSameAuthor ? (
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{message.authorName}</span>
                        <span>{new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ) : null}

                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {message.body}
                    </p>

                    {message.attachments.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {message.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="rounded-xl border border-border/80 bg-background/60 p-3"
                          >
                            {attachment.kind === 'image' ? (
                              <a href={attachment.url} rel="noreferrer" target="_blank">
                                <img
                                  alt={attachment.name}
                                  className="max-h-72 w-full rounded-lg object-cover"
                                  src={attachment.url}
                                />
                              </a>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                                    <Paperclip size={16} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{attachment.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatBytes(attachment.size)}</p>
                                  </div>
                                </div>
                                <a
                                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold transition hover:bg-muted"
                                  download={attachment.name}
                                  href={attachment.url}
                                >
                                  <Download size={14} />
                                  Baixar
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {message.linkPreview ? (
                      <div className="mt-3">
                        <LinkPreviewCard preview={message.linkPreview} />
                      </div>
                    ) : null}

                    {message.body.includes('@') ? (
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <ImageIcon size={12} />
                        Mencoes detectadas na mensagem
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
