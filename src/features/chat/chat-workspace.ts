import type { ChatWorkspaceChannel, ChatWorkspaceMessage } from './chat-queries';

export type ChatAttachment = {
  created_at: string;
  id: string;
  kind: 'file' | 'image';
  mime_type: string;
  name: string;
  size: number;
  url: string;
};

export type ChatLinkPreview = {
  description: string | null;
  domain: string;
  image_url: string | null;
  title: string | null;
  url: string;
};

export type ChatDecoratedMessage = ChatWorkspaceMessage & {
  attachments: ChatAttachment[];
  linkPreview: ChatLinkPreview | null;
};

export function groupChannels(channels: ChatWorkspaceChannel[]) {
  return {
    archived: channels.filter((channel) => channel.is_archived),
    clients: channels.filter((channel) => !channel.is_archived && channel.scope === 'client'),
    general: channels.filter((channel) => !channel.is_archived && channel.scope === 'general'),
    leads: channels.filter((channel) => !channel.is_archived && channel.scope === 'commercial'),
    projects: channels.filter(
      (channel) =>
        !channel.is_archived &&
        (Boolean(channel.project_id) || channel.scope === 'operations'),
    ),
  };
}

export function groupMessagesByDay(messages: ChatDecoratedMessage[]) {
  const groups = new Map<string, ChatDecoratedMessage[]>();

  for (const message of messages) {
    const date = new Date(message.created_at);
    const key = Number.isNaN(date.getTime())
      ? 'Sem data'
      : date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
    const items = groups.get(key) ?? [];
    items.push(message);
    groups.set(key, items);
  }

  return Array.from(groups.entries()).map(([dateLabel, items]) => ({ dateLabel, items }));
}

export function buildLinkPreview(body: string): ChatLinkPreview | null {
  const urlMatch = body.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) return null;

  try {
    const url = new URL(urlMatch[0]);
    return {
      description: 'Link compartilhado na conversa.',
      domain: url.hostname.replace(/^www\./, ''),
      image_url: null,
      title: url.hostname.replace(/^www\./, ''),
      url: url.toString(),
    };
  } catch {
    return null;
  }
}
