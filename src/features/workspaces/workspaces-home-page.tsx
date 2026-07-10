import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, Loader2, Plus, Search, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';

import { NotificationBell } from './notification-bell';
import { PendingInvitationCard } from './pending-invitation-card';
import { useWorkspace } from './workspace-context';
import {
  createLocalWorkspace,
  localWorkspaceOwnerId,
  markLocalNotificationAsRead,
  respondToLocalInvitation,
} from './workspace-data';
import {
  acceptWorkspaceInvitation,
  createWorkspace,
  declineWorkspaceInvitation,
  fetchWorkspacesState,
  markNotificationAsRead,
  workspacesQueryKey,
} from './workspace-queries';
import { writeActiveWorkspace } from './workspace-storage';
import { slugifyWorkspaceName } from './workspace-utils';
import { WorkspaceCard } from './workspace-card';

export function WorkspacesHomePage() {
  const { signOut, user, isSupabaseConfigured } = useAuth();
  const { invitations, notifications, refreshWorkspaceState, workspaces } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== localWorkspaceOwnerId;
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [isCreatingLocally, setIsCreatingLocally] = useState(false);

  const createWorkspaceMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
    },
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: acceptWorkspaceInvitation,
    onSuccess: async () => {
      await refreshWorkspaceState();
    },
  });

  const declineInvitationMutation = useMutation({
    mutationFn: declineWorkspaceInvitation,
    onSuccess: async () => {
      await refreshWorkspaceState();
    },
  });

  const filteredWorkspaces = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return workspaces;
    return workspaces.filter((workspace) =>
      `${workspace.name} ${workspace.slug}`.toLowerCase().includes(normalized),
    );
  }, [search, workspaces]);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreate(true);
    }
  }, [searchParams]);

  function buildAvailableSlug(name: string) {
    const baseSlug = slugifyWorkspaceName(name);
    const existingSlugs = new Set(workspaces.map((workspace) => workspace.slug));

    if (!existingSlugs.has(baseSlug)) {
      return baseSlug;
    }

    let counter = 2;
    let nextSlug = `${baseSlug}-${counter}`;
    while (existingSlugs.has(nextSlug)) {
      counter += 1;
      nextSlug = `${baseSlug}-${counter}`;
    }

    return nextSlug;
  }

  async function handleCreateWorkspace() {
    const name = workspaceName.trim();
    if (!name) return;
    const slug = buildAvailableSlug(name);

    try {
      if (hasRealSession) {
        const result = await createWorkspaceMutation.mutateAsync({ name, slug });
        const nextSlug = String((result as { slug?: string }).slug ?? slug);
        const nextId = String((result as { id?: string }).id ?? '');
        await refreshWorkspaceState();

        const refreshedState = await queryClient.fetchQuery({
          queryKey: workspacesQueryKey,
          queryFn: fetchWorkspacesState,
        });

        const createdWorkspace =
          refreshedState.workspaces.find((workspace) => workspace.id === nextId) ??
          refreshedState.workspaces.find((workspace) => workspace.slug === nextSlug);

        if (!createdWorkspace) {
          throw new Error('O workspace foi criado, mas ainda nao apareceu na lista. Tente abrir novamente em alguns segundos.');
        }

        writeActiveWorkspace({ id: createdWorkspace.id, slug: createdWorkspace.slug });
        navigate(`/w/${createdWorkspace.slug}/dashboard`);
      } else {
        setIsCreatingLocally(true);
        const workspace = createLocalWorkspace(user?.id ?? localWorkspaceOwnerId, { name, slug });
        writeActiveWorkspace({ id: workspace.id, slug: workspace.slug });
        await refreshWorkspaceState();
        navigate(`/w/${workspace.slug}/dashboard`);
      }
      setWorkspaceName('');
      setShowCreate(false);
      if (searchParams.get('create')) {
        setSearchParams({}, { replace: true });
      }
      toast.success('Workspace criado com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel criar o workspace.');
    } finally {
      setIsCreatingLocally(false);
    }
  }

  async function handleOpenWorkspace(workspace: { id: string; slug: string }) {
    writeActiveWorkspace(workspace);
    await refreshWorkspaceState();
    navigate(`/w/${workspace.slug}/dashboard`);
  }

  async function handleAcceptInvitation(invitationId: string) {
    try {
      if (hasRealSession) {
        await acceptInvitationMutation.mutateAsync(invitationId);
      } else {
        respondToLocalInvitation(user?.id ?? localWorkspaceOwnerId, invitationId, 'accepted');
        await refreshWorkspaceState();
      }
      toast.success('Convite aceito.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel aceitar o convite.');
    }
  }

  async function handleDeclineInvitation(invitationId: string) {
    try {
      if (hasRealSession) {
        await declineInvitationMutation.mutateAsync(invitationId);
      } else {
        respondToLocalInvitation(user?.id ?? localWorkspaceOwnerId, invitationId, 'declined');
        await refreshWorkspaceState();
      }
      toast.success('Convite recusado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel recusar o convite.');
    }
  }

  return (
    <main className="min-h-dvh bg-background p-5 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Badge tone="brand">Workspace Hub</Badge>
              <div>
                <h1 className="text-3xl font-semibold">Seus workspaces</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Agora o CRM parte de uma camada propria de acesso, workspaces, convites e identidade inicial.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <NotificationBell
                onMarkRead={(notificationId) => {
                  if (hasRealSession) {
                    void markNotificationAsRead(notificationId).then(() => refreshWorkspaceState());
                  } else {
                    markLocalNotificationAsRead(user?.id ?? localWorkspaceOwnerId, notificationId);
                    void refreshWorkspaceState();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={() => setShowCreate((value) => !value)}>
                <Plus size={16} />
                Criar workspace
              </Button>
              <Button type="button" variant="ghost" onClick={signOut}>
                Sair
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                className="pl-9"
                placeholder="Buscar workspace por nome ou slug"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
              <UserRound size={16} className="text-brand" />
              <div>
                <p className="text-sm font-semibold">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </div>

          {showCreate ? (
            <div className="mt-6 rounded-2xl border border-border bg-background p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto]">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Nome do workspace</span>
                  <Input
                    placeholder="Ex.: Arroba Co"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Slug</span>
                  <Input readOnly value={workspaceName.trim() ? buildAvailableSlug(workspaceName) : ''} />
                </label>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={createWorkspaceMutation.isPending || isCreatingLocally}
                    type="button"
                    onClick={() => void handleCreateWorkspace()}
                  >
                    {createWorkspaceMutation.isPending || isCreatingLocally ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Building2 size={16} />
                    )}
                    Criar
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Workspaces ativos</h2>
              <Badge tone="neutral">{filteredWorkspaces.length}</Badge>
            </div>

            {filteredWorkspaces.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredWorkspaces.map((workspace) => (
                  <WorkspaceCard
                    key={workspace.id}
                    workspace={workspace}
                    onOpen={handleOpenWorkspace}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Nenhum workspace encontrado. Crie o primeiro para comecar.
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Convites pendentes</h2>
              <Badge tone={invitations.length > 0 ? 'warning' : 'success'}>{invitations.length}</Badge>
            </div>

            {invitations.length > 0 ? (
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <PendingInvitationCard
                    key={invitation.id}
                    invitation={invitation}
                    onAccept={(invitationId) => void handleAcceptInvitation(invitationId)}
                    onDecline={(invitationId) => void handleDeclineInvitation(invitationId)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Sem convites pendentes no momento.
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Notificacoes recentes</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      O mesmo feed aparece aqui e tambem no sino dentro dos workspaces.
                    </p>
                  </div>
                  <Badge tone="brand">{notifications.length}</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {notifications.slice(0, 4).map((notification) => (
                    <div key={notification.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{notification.title}</p>
                        {!notification.readAt ? <span className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
                      </div>
                      {notification.body ? (
                        <p className="mt-2 text-sm text-muted-foreground">{notification.body}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Proximo passo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Depois de entrar em um workspace, o CRM abre normalmente em dashboard, comercial, clientes, documentos e chat.
              </p>
            </div>
            {workspaces[0] ? (
              <Button type="button" onClick={() => void handleOpenWorkspace(workspaces[0])}>
                Entrar no ultimo workspace
                <ArrowRight size={16} />
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
