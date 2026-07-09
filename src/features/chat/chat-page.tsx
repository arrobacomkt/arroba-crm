import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, Loader2, MessageSquareText, Plus, Search, Send, UsersRound, X } from 'lucide-react';
import { type ReactNode, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';

import { chatScopeLabels, chatScopeOptions, chatScopeTone } from './chat-constants';
import { createLocalChannel, createLocalMessage, loadLocalChatWorkspace } from './chat-data';
import {
  chatWorkspaceQueryKey,
  createChatChannel,
  createChatMessage,
  fetchChatWorkspace,
  type ChatWorkspace,
  type ChatWorkspaceChannel,
} from './chat-queries';

type ChannelFormState = {
  accountId: string;
  description: string;
  projectId: string;
  scope: ChatWorkspaceChannel['scope'];
  title: string;
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderMessageBody(body: string) {
  const parts = body.split(/(@[A-Za-zÀ-ÿ0-9_-]+)/g);

  return parts.map((part, index) =>
    part.startsWith('@') ? (
      <span key={`${part}-${index}`} className="font-semibold text-brand">
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

export function ChatPage() {
  const { isSupabaseConfigured, user } = useAuth();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: chatWorkspaceQueryKey,
    queryFn: fetchChatWorkspace,
    enabled: hasRealSession,
    refetchInterval: hasRealSession ? 8000 : false,
  });

  const [localWorkspace, setLocalWorkspace] = useState(() => loadLocalChatWorkspace());
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelForm, setChannelForm] = useState<ChannelFormState>({
    title: '',
    description: '',
    scope: 'general',
    accountId: '',
    projectId: '',
  });

  const localWorkspaceView = useMemo<ChatWorkspace>(() => {
    const accountById = new Map(
      localWorkspace.accounts.map((account) => [account.id, account.display_name]),
    );
    const projectById = new Map(
      localWorkspace.projects.map((project) => [project.id, project.title]),
    );
    const memberById = new Map(localWorkspace.members.map((member) => [member.id, member]));
    const messageSummaryByChannelId = new Map<
      string,
      { lastMessageAt: string | null; lastMessagePreview: string | null; messageCount: number }
    >();

    for (const message of localWorkspace.messages) {
      const current = messageSummaryByChannelId.get(message.channel_id) ?? {
        lastMessageAt: null,
        lastMessagePreview: null,
        messageCount: 0,
      };
      current.messageCount += 1;
      if (!current.lastMessageAt || message.created_at >= current.lastMessageAt) {
        current.lastMessageAt = message.created_at;
        current.lastMessagePreview = message.body;
      }
      messageSummaryByChannelId.set(message.channel_id, current);
    }

    return {
      accounts: localWorkspace.accounts,
      projects: localWorkspace.projects,
      members: localWorkspace.members,
      channels: localWorkspace.channels.map((channel) => {
        const summary = messageSummaryByChannelId.get(channel.id) ?? {
          lastMessageAt: null,
          lastMessagePreview: null,
          messageCount: 0,
        };

        return {
          ...channel,
          accountName: channel.account_id ? (accountById.get(channel.account_id) ?? null) : null,
          projectTitle: channel.project_id ? (projectById.get(channel.project_id) ?? null) : null,
          lastMessageAt: summary.lastMessageAt,
          lastMessagePreview: summary.lastMessagePreview,
          messageCount: summary.messageCount,
        };
      }),
      messages: localWorkspace.messages.map((message) => {
        const member = message.author_id ? memberById.get(message.author_id) : null;
        return {
          ...message,
          authorName: member?.full_name ?? 'Equipe Arroba Co',
          authorEmail: member?.email ?? null,
        };
      }),
    };
  }, [localWorkspace]);

  const workspace = hasRealSession
    ? (workspaceQuery.data ?? {
        accounts: [],
        channels: [],
        members: [],
        messages: [],
        projects: [],
      })
    : localWorkspaceView;

  const filteredChannels = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return workspace.channels.filter((channel) => {
      if (!normalizedSearch) return true;

      const haystack = [
        channel.title,
        channel.description ?? '',
        channel.accountName ?? '',
        channel.projectTitle ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [search, workspace.channels]);

  const activeChannel =
    filteredChannels.find((channel) => channel.id === selectedChannelId) ??
    filteredChannels[0] ??
    null;

  const channelMessages = useMemo(
    () =>
      activeChannel
        ? workspace.messages.filter((message) => message.channel_id === activeChannel.id)
        : [],
    [activeChannel, workspace.messages],
  );

  const currentProjects = useMemo(() => {
    if (!channelForm.accountId) return workspace.projects;
    return workspace.projects.filter((project) => project.account_id === channelForm.accountId);
  }, [channelForm.accountId, workspace.projects]);

  const stats = useMemo(
    () => ({
      channels: workspace.channels.length,
      members: workspace.members.length,
      messages: workspace.messages.length,
      clientChannels: workspace.channels.filter((channel) => channel.scope === 'client').length,
    }),
    [workspace.channels, workspace.members, workspace.messages],
  );

  const createChannelMutation = useMutation({
    mutationFn: createChatChannel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chatWorkspaceQueryKey });
      toast.success('Canal criado com sucesso.');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createMessageMutation = useMutation({
    mutationFn: createChatMessage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chatWorkspaceQueryKey });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function resetChannelForm() {
    setChannelForm({
      title: '',
      description: '',
      scope: 'general',
      accountId: '',
      projectId: '',
    });
  }

  function handleCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      title: channelForm.title.trim(),
      description: channelForm.description.trim() ? channelForm.description.trim() : null,
      scope: channelForm.scope,
      accountId: channelForm.accountId || null,
      projectId: channelForm.projectId || null,
    };

    if (!payload.title) {
      toast.error('Defina um titulo para o canal.');
      return;
    }

    if (hasRealSession) {
      createChannelMutation.mutate(payload, {
        onSuccess: (createdChannel) => {
          setSelectedChannelId(createdChannel.id);
          setShowChannelModal(false);
          resetChannelForm();
        },
      });
      return;
    }

    const nextWorkspace = createLocalChannel(localWorkspace, payload, user?.id ?? null);
    setLocalWorkspace(nextWorkspace);
    setSelectedChannelId(nextWorkspace.channels[0]?.id ?? null);
    setShowChannelModal(false);
    resetChannelForm();
    toast.success('Canal criado localmente.');
  }

  function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeChannel) return;

    const body = messageDraft.trim();
    if (!body) {
      toast.error('Escreva uma mensagem antes de enviar.');
      return;
    }

    if (hasRealSession) {
      createMessageMutation.mutate(
        { channelId: activeChannel.id, body },
        {
          onSuccess: () => {
            setMessageDraft('');
          },
        },
      );
      return;
    }

    setLocalWorkspace((current) =>
      createLocalMessage(current, {
        channelId: activeChannel.id,
        body,
        authorId: user?.id ?? null,
      }),
    );
    setMessageDraft('');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Canais internos para alinhamentos operacionais, comerciais e de clientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {workspaceQuery.isFetching || createMessageMutation.isPending ? (
            <Badge tone="neutral">
              <Loader2 className="mr-1 animate-spin" size={13} />
              Atualizando
            </Badge>
          ) : null}
          <Badge tone={hasRealSession ? 'success' : 'neutral'}>
            {hasRealSession ? 'Supabase' : 'Local'}
          </Badge>
          <Button onClick={() => setShowChannelModal(true)}>
            <Plus size={18} />
            Novo canal
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<Hash size={20} />} label="Canais" value={String(stats.channels)} />
        <StatCard icon={<UsersRound size={20} />} label="Membros" value={String(stats.members)} />
        <StatCard
          icon={<MessageSquareText size={20} />}
          label="Mensagens"
          value={String(stats.messages)}
        />
        <StatCard
          icon={<UsersRound size={20} />}
          label="Canais de cliente"
          value={String(stats.clientChannels)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold">Canais</h2>
                <p className="text-sm text-muted-foreground">
                  Busque conversas por frente, cliente ou projeto.
                </p>
              </div>
              <label className="relative block">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  className="pl-9"
                  placeholder="Buscar canal"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {workspaceQuery.isError ? (
              <p className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
                {workspaceQuery.error.message}
              </p>
            ) : filteredChannels.length > 0 ? (
              <div className="space-y-3">
                {filteredChannels.map((channel) => (
                  <article
                    key={channel.id}
                    className={[
                      'cursor-pointer rounded-md border p-4 transition-colors',
                      activeChannel?.id === channel.id
                        ? 'border-brand bg-brand/5'
                        : 'border-border hover:border-brand/40 hover:bg-muted/30',
                    ].join(' ')}
                    onClick={() => setSelectedChannelId(channel.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-semibold">{channel.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {channel.description || 'Sem descricao adicional.'}
                        </p>
                      </div>
                      <Badge tone={chatScopeTone(channel.scope)}>
                        {chatScopeLabels[channel.scope]}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {channel.accountName ? (
                        <Badge tone="neutral">{channel.accountName}</Badge>
                      ) : null}
                      {channel.projectTitle ? (
                        <Badge tone="neutral">{channel.projectTitle}</Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{channel.messageCount} mensagem(ns)</span>
                      <span>
                        {channel.lastMessageAt
                          ? formatDateTime(channel.lastMessageAt)
                          : 'Sem atividade'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Hash size={22} />}
                title="Nenhum canal encontrado"
                description="Crie um novo canal ou ajuste a busca."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            {activeChannel ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{activeChannel.title}</h2>
                      <Badge tone={chatScopeTone(activeChannel.scope)}>
                        {chatScopeLabels[activeChannel.scope]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeChannel.description || 'Canal interno da operacao.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeChannel.accountName ? (
                      <Badge tone="neutral">{activeChannel.accountName}</Badge>
                    ) : null}
                    {activeChannel.projectTitle ? (
                      <Badge tone="neutral">{activeChannel.projectTitle}</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="font-semibold">Thread</h2>
                <p className="text-sm text-muted-foreground">Selecione um canal para conversar.</p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {activeChannel ? (
              <div className="space-y-4">
                {channelMessages.length > 0 ? (
                  <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                    {channelMessages.map((message) => {
                      const isCurrentUser = message.author_id === user?.id;
                      return (
                        <article
                          key={message.id}
                          className={['flex', isCurrentUser ? 'justify-end' : 'justify-start'].join(
                            ' ',
                          )}
                        >
                          <div
                            className={[
                              'max-w-[88%] rounded-md border px-4 py-3',
                              isCurrentUser
                                ? 'border-brand/30 bg-brand/5'
                                : 'border-border bg-muted/30',
                            ].join(' ')}
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold">{message.authorName}</p>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(message.created_at)}
                              </span>
                            </div>
                            <p className="text-sm leading-6 text-foreground">
                              {renderMessageBody(message.body)}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<MessageSquareText size={22} />}
                    title="Sem mensagens ainda"
                    description="Esse canal acabou de nascer. Pode mandar a primeira."
                  />
                )}

                <form
                  className="space-y-3 border-t border-border pt-4"
                  onSubmit={handleSendMessage}
                >
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Nova mensagem</span>
                    <textarea
                      className="min-h-28 w-full rounded-md border border-border bg-card px-3 py-3 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      placeholder="Escreva aqui. Use @Davi ou @Richards para destacar alguem."
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                    />
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Mencoes visuais prontas para a equipe interna.
                    </p>
                    <Button disabled={createMessageMutation.isPending} type="submit">
                      {createMessageMutation.isPending ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                      Enviar
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <EmptyState
                icon={<MessageSquareText size={22} />}
                title="Selecione um canal"
                description="Abra um canal para acompanhar a conversa da equipe."
              />
            )}
          </CardContent>
        </Card>
      </section>

      {showChannelModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            aria-modal="true"
            className="w-full max-w-2xl rounded-md border border-border bg-card shadow-xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold text-brand">Novo canal</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie uma conversa por frente, cliente ou projeto.
                </p>
              </div>
              <Button
                className="h-8 w-8 px-0"
                title="Fechar"
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowChannelModal(false);
                  resetChannelForm();
                }}
              >
                <X size={16} />
              </Button>
            </div>

            <form className="space-y-4 p-5" onSubmit={handleCreateChannel}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Titulo</span>
                <Input
                  required
                  value={channelForm.title}
                  onChange={(event) =>
                    setChannelForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Descricao</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  value={channelForm.description}
                  onChange={(event) =>
                    setChannelForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Escopo</span>
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    value={channelForm.scope}
                    onChange={(event) =>
                      setChannelForm((current) => ({
                        ...current,
                        scope: event.target.value as ChatWorkspaceChannel['scope'],
                      }))
                    }
                  >
                    {chatScopeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {chatScopeLabels[option.value]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Cliente</span>
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    value={channelForm.accountId}
                    onChange={(event) =>
                      setChannelForm((current) => ({
                        ...current,
                        accountId: event.target.value,
                        projectId:
                          workspace.projects.find(
                            (project) => project.account_id === event.target.value,
                          )?.id ?? '',
                      }))
                    }
                  >
                    <option value="">Sem cliente</option>
                    {workspace.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.display_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Projeto</span>
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    value={channelForm.projectId}
                    onChange={(event) =>
                      setChannelForm((current) => ({ ...current, projectId: event.target.value }))
                    }
                  >
                    <option value="">Sem projeto</option>
                    {currentProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowChannelModal(false);
                    resetChannelForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button disabled={createChannelMutation.isPending} type="submit">
                  {createChannelMutation.isPending ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  Criar canal
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold data-tabular">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
