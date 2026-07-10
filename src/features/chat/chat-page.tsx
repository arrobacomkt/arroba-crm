import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Hash,
  Info,
  Loader2,
  MessageSquareText,
  Plus,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';

import { ChannelDetailsPanel } from './channel-details-panel';
import {
  createLocalChannel,
  createLocalMessage,
  loadLocalChatWorkspace,
  type LocalChatWorkspace,
} from './chat-data';
import {
  chatWorkspaceQueryKey,
  createChatChannel,
  createChatMessage,
  fetchChatWorkspace,
} from './chat-queries';
import { ChannelSection } from './channel-section';
import { MessageComposer } from './message-composer';
import { MessageList } from './message-list';
import {
  buildLinkPreview,
  groupChannels,
  type ChatAttachment,
  type ChatDecoratedMessage,
} from './chat-workspace';

type ChatUiState = {
  attachmentsByMessage: Record<string, ChatAttachment[]>;
  lastOpenedChannelId: string | null;
  lastSeenByChannel: Record<string, string>;
};

const chatUiStorageKey = 'arrobaco.chat.workspace-ui.v1';

export function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { channelId } = useParams();
  const { isSupabaseConfigured, user } = useAuth();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';
  const [localWorkspace, setLocalWorkspace] = useState<LocalChatWorkspace>(() => loadLocalChatWorkspace());
  const [chatUi, setChatUi] = useState<ChatUiState>(() => readChatUiState(loadLocalChatWorkspace().lastOpenedChannelId));
  const [channelSearch, setChannelSearch] = useState('');
  const [showDetails, setShowDetails] = useState(true);

  const workspaceQuery = useQuery({
    queryKey: chatWorkspaceQueryKey,
    queryFn: fetchChatWorkspace,
    enabled: hasRealSession,
    refetchInterval: hasRealSession ? 6000 : false,
  });

  const createChannelMutation = useMutation({
    mutationFn: createChatChannel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chatWorkspaceQueryKey });
    },
  });

  const createMessageMutation = useMutation({
    mutationFn: createChatMessage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chatWorkspaceQueryKey });
    },
  });

  const workspace = hasRealSession
    ? (workspaceQuery.data ?? { accounts: [], channels: [], members: [], messages: [], projects: [] })
    : {
        accounts: localWorkspace.accounts,
        channels: localWorkspace.channels.map((channel) => {
          const accountName =
            localWorkspace.accounts.find((account) => account.id === channel.account_id)?.display_name ?? null;
          const projectTitle =
            localWorkspace.projects.find((project) => project.id === channel.project_id)?.title ?? null;
          const channelMessages = localWorkspace.messages.filter((message) => message.channel_id === channel.id);
          const lastMessage = channelMessages.at(-1) ?? null;

          return {
            ...channel,
            accountName,
            lastMessageAt: lastMessage?.created_at ?? channel.last_message_at,
            lastMessagePreview: lastMessage?.body ?? null,
            messageCount: channelMessages.length,
            projectTitle,
          };
        }),
        members: localWorkspace.members,
        messages: localWorkspace.messages.map((message) => {
          const author = localWorkspace.members.find((member) => member.id === message.author_id);
          return {
            ...message,
            authorEmail: author?.email ?? null,
            authorName: author?.full_name ?? 'Equipe Arroba Co',
          };
        }),
        projects: localWorkspace.projects,
      };

  const visibleChannels = useMemo(() => {
    const normalizedSearch = channelSearch.trim().toLowerCase();
    return workspace.channels.filter((channel) => {
      if (!normalizedSearch) return true;
      return [
        channel.title,
        channel.description ?? '',
        channel.accountName ?? '',
        channel.projectTitle ?? '',
        channel.lastMessagePreview ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [channelSearch, workspace.channels]);

  const groupedChannels = useMemo(() => groupChannels(visibleChannels), [visibleChannels]);
  const activeChannel =
    workspace.channels.find((channel) => channel.id === channelId) ??
    workspace.channels.find((channel) => channel.id === chatUi.lastOpenedChannelId) ??
    workspace.channels.find((channel) => channel.scope === 'general') ??
    workspace.channels[0] ??
    null;

  const activeMessages = useMemo(
    () => (activeChannel ? workspace.messages.filter((message) => message.channel_id === activeChannel.id) : []),
    [activeChannel, workspace.messages],
  );

  const attachmentsByMessage = hasRealSession
    ? chatUi.attachmentsByMessage
    : { ...localWorkspace.attachmentsByMessage, ...chatUi.attachmentsByMessage };

  const decoratedMessages = useMemo<ChatDecoratedMessage[]>(
    () =>
      activeMessages.map((message) => ({
        ...message,
        attachments: attachmentsByMessage[message.id] ?? [],
        linkPreview: buildLinkPreview(message.body),
      })),
    [activeMessages, attachmentsByMessage],
  );

  const unreadChannelIds = useMemo(() => {
    const unread = new Set<string>();

    for (const channel of workspace.channels) {
      if (!channel.lastMessageAt) continue;
      const seenAt = chatUi.lastSeenByChannel[channel.id];
      if (!seenAt || seenAt < channel.lastMessageAt) unread.add(channel.id);
    }

    return unread;
  }, [chatUi.lastSeenByChannel, workspace.channels]);

  const shouldShowMobileSidebar = searchParams.get('view') === 'list' || !activeChannel;

  useEffect(() => {
    if (location.pathname !== '/app/chat') return;
    if (searchParams.get('view') === 'list') return;
    if (activeChannel) {
      navigate(`/app/chat/canal/${activeChannel.id}`, { replace: true });
    }
  }, [activeChannel, location.pathname, navigate, searchParams]);

  useEffect(() => {
    if (!activeChannel) return;
    persistChatUi({
      ...chatUi,
      lastOpenedChannelId: activeChannel.id,
      lastSeenByChannel: {
        ...chatUi.lastSeenByChannel,
        [activeChannel.id]: activeMessages.at(-1)?.created_at ?? new Date().toISOString(),
      },
    });
  }, [activeChannel?.id, activeMessages, activeMessages.length]);

  function persistChatUi(nextState: ChatUiState) {
    setChatUi(nextState);
    window.localStorage.setItem(chatUiStorageKey, JSON.stringify(nextState));
  }

  function openChannel(nextChannelId: string) {
    navigate(`/app/chat/canal/${nextChannelId}`);
  }

  async function handleCreateChannel() {
    const title = window.prompt('Nome do novo canal');
    if (!title?.trim()) return;

    const description = window.prompt('Descricao curta do canal') ?? '';
    const scopeAnswer = (window.prompt('Escopo: geral, comercial, operacao ou cliente', 'geral') ?? 'geral')
      .trim()
      .toLowerCase();

    const scope =
      scopeAnswer === 'comercial'
        ? 'commercial'
        : scopeAnswer === 'operacao'
          ? 'operations'
          : scopeAnswer === 'cliente'
            ? 'client'
            : 'general';

    try {
      if (hasRealSession) {
        const created = await createChannelMutation.mutateAsync({
          accountId: null,
          description,
          projectId: null,
          scope,
          title,
        });
        navigate(`/app/chat/canal/${created.id}`);
      } else {
        const nextWorkspace = createLocalChannel(localWorkspace, {
          accountId: null,
          description,
          projectId: null,
          scope,
          title,
        }, user?.id ?? null);
        setLocalWorkspace(nextWorkspace);
        navigate(`/app/chat/canal/${nextWorkspace.channels[0]?.id ?? ''}`);
      }
      toast.success('Canal criado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel criar o canal.');
    }
  }

  async function handleSendMessage(payload: { attachments: ChatAttachment[]; body: string }) {
    if (!activeChannel) return;

    try {
      if (hasRealSession) {
        const created = await createMessageMutation.mutateAsync({
          body: payload.body,
          channelId: activeChannel.id,
        });

        if (payload.attachments.length > 0) {
          persistChatUi({
            ...chatUi,
            attachmentsByMessage: {
              ...chatUi.attachmentsByMessage,
              [created.id]: payload.attachments,
            },
            lastOpenedChannelId: activeChannel.id,
          });
        }
      } else {
        setLocalWorkspace((current) =>
          createLocalMessage(current, {
            attachments: payload.attachments,
            authorId: user?.id ?? null,
            body: payload.body,
            channelId: activeChannel.id,
          }),
        );
      }

      persistChatUi({
        ...chatUi,
        lastOpenedChannelId: activeChannel.id,
        lastSeenByChannel: {
          ...chatUi.lastSeenByChannel,
          [activeChannel.id]: new Date().toISOString(),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel enviar a mensagem.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Central de conversa</p>
          <p className="text-sm text-muted-foreground">
            Canais agrupados por frente, com navegação lateral e painel de contexto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(workspaceQuery.isFetching || createChannelMutation.isPending || createMessageMutation.isPending) ? (
            <Badge tone="warning">
              <Loader2 className="mr-1 animate-spin" size={13} />
              Sincronizando
            </Badge>
          ) : null}
          <Badge tone={hasRealSession ? 'success' : 'neutral'}>{hasRealSession ? 'Supabase' : 'Local'}</Badge>
          <Button type="button" onClick={() => void handleCreateChannel()}>
            <Plus size={16} />
            Novo canal
          </Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="grid min-h-[calc(100vh-12rem)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className={`${shouldShowMobileSidebar ? 'block' : 'hidden'} border-b border-border bg-card xl:block xl:border-b-0 xl:border-r`}>
            <div className="space-y-5 p-4">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  className="pl-9"
                  placeholder="Buscar canais"
                  value={channelSearch}
                  onChange={(event) => setChannelSearch(event.target.value)}
                />
              </label>

              <div className="space-y-5">
                <ChannelSection
                  channels={groupedChannels.general}
                  title="Canais gerais"
                  unreadChannelIds={unreadChannelIds}
                  activeChannelId={activeChannel?.id ?? null}
                  onOpenChannel={openChannel}
                />
                <ChannelSection
                  channels={groupedChannels.clients}
                  title="Clientes"
                  unreadChannelIds={unreadChannelIds}
                  activeChannelId={activeChannel?.id ?? null}
                  onOpenChannel={openChannel}
                />
                <ChannelSection
                  channels={groupedChannels.projects}
                  title="Projetos"
                  unreadChannelIds={unreadChannelIds}
                  activeChannelId={activeChannel?.id ?? null}
                  onOpenChannel={openChannel}
                />
                <ChannelSection
                  channels={groupedChannels.leads}
                  title="Leads"
                  unreadChannelIds={unreadChannelIds}
                  activeChannelId={activeChannel?.id ?? null}
                  onOpenChannel={openChannel}
                />
                <ChannelSection
                  channels={groupedChannels.archived}
                  title="Arquivados"
                  unreadChannelIds={unreadChannelIds}
                  activeChannelId={activeChannel?.id ?? null}
                  onOpenChannel={openChannel}
                />
              </div>
            </div>
          </aside>

          <div className={`${shouldShowMobileSidebar ? 'hidden xl:flex' : 'flex'} min-w-0 flex-col bg-background`}>
            {activeChannel ? (
              <>
                <header className="border-b border-border bg-card px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Button
                        className="h-9 w-9 px-0 xl:hidden"
                        type="button"
                        variant="ghost"
                        onClick={() => navigate('/app/chat?view=list')}
                      >
                        <ChevronLeft size={16} />
                      </Button>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="rounded-lg bg-brand/12 p-2 text-brand">
                            <Hash size={16} />
                          </div>
                          <h1 className="text-lg font-semibold">{activeChannel.title}</h1>
                          {activeChannel.accountName ? <Badge tone="neutral">{activeChannel.accountName}</Badge> : null}
                          {activeChannel.projectTitle ? <Badge tone="brand">{activeChannel.projectTitle}</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {activeChannel.description || 'Canal interno para alinhamento rapido da equipe.'}
                        </p>
                      </div>
                    </div>

                    <Button type="button" variant="secondary" onClick={() => setShowDetails((current) => !current)}>
                      <Info size={16} />
                      {showDetails ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                    </Button>
                  </div>
                </header>

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex-1 overflow-y-auto p-5">
                    <MessageList currentUserId={user?.id} messages={decoratedMessages} />
                  </div>
                  <div className="border-t border-border p-5">
                    <MessageComposer
                      isSending={createMessageMutation.isPending}
                      members={workspace.members}
                      onSend={handleSendMessage}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8">
                <EmptyState
                  icon={<MessageSquareText size={20} />}
                  title="Nenhum canal disponivel"
                  description="Crie o primeiro canal para iniciar a central de conversas."
                />
              </div>
            )}
          </div>

          {showDetails && activeChannel ? (
            <div className={`${shouldShowMobileSidebar ? 'hidden' : 'hidden xl:block'}`}>
              <ChannelDetailsPanel
                channel={activeChannel}
                membersCount={workspace.members.length}
                messages={decoratedMessages}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function readChatUiState(defaultLastOpenedChannelId: string | null): ChatUiState {
  if (typeof window === 'undefined') {
    return {
      attachmentsByMessage: {},
      lastOpenedChannelId: defaultLastOpenedChannelId,
      lastSeenByChannel: {},
    };
  }

  try {
    const raw = window.localStorage.getItem(chatUiStorageKey);
    if (!raw) {
      return {
        attachmentsByMessage: {},
        lastOpenedChannelId: defaultLastOpenedChannelId,
        lastSeenByChannel: {},
      };
    }

    const parsed = JSON.parse(raw) as Partial<ChatUiState>;
    return {
      attachmentsByMessage:
        parsed.attachmentsByMessage && typeof parsed.attachmentsByMessage === 'object'
          ? (parsed.attachmentsByMessage as Record<string, ChatAttachment[]>)
          : {},
      lastOpenedChannelId:
        typeof parsed.lastOpenedChannelId === 'string'
          ? parsed.lastOpenedChannelId
          : defaultLastOpenedChannelId,
      lastSeenByChannel:
        parsed.lastSeenByChannel && typeof parsed.lastSeenByChannel === 'object'
          ? (parsed.lastSeenByChannel as Record<string, string>)
          : {},
    };
  } catch {
    return {
      attachmentsByMessage: {},
      lastOpenedChannelId: defaultLastOpenedChannelId,
      lastSeenByChannel: {},
    };
  }
}
