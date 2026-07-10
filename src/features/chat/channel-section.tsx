import { ChevronDown, Hash, MessagesSquare } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

import type { ChatWorkspaceChannel } from './chat-queries';

type ChannelSectionProps = {
  activeChannelId: string | null;
  channels: ChatWorkspaceChannel[];
  onOpenChannel: (channelId: string) => void;
  title: string;
  unreadChannelIds: Set<string>;
};

export function ChannelSection({
  activeChannelId,
  channels,
  onOpenChannel,
  title,
  unreadChannelIds,
}: ChannelSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="space-y-2">
      <button
        className="flex w-full items-center justify-between gap-3 text-left"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={cn('transition', !isOpen && '-rotate-90')} size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
        </div>
        <Badge tone="neutral">{channels.length}</Badge>
      </button>

      {isOpen ? (
        channels.length > 0 ? (
          <div className="space-y-1">
            {channels.map((channel) => {
              const unread = unreadChannelIds.has(channel.id);
              const isActive = channel.id === activeChannelId;
              return (
                <button
                  key={channel.id}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition',
                    isActive ? 'bg-brand/12' : 'hover:bg-muted',
                  )}
                  type="button"
                  onClick={() => onOpenChannel(channel.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Hash size={14} className="shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{channel.title}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {channel.accountName ?? channel.projectTitle ?? channel.description ?? 'Sem descricao'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {unread ? <span className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
                    {channel.lastMessageAt ? (
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(channel.lastMessageAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      <MessagesSquare size={14} className="text-muted-foreground" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Nenhum canal neste grupo.
          </div>
        )
      ) : null}
    </section>
  );
}
