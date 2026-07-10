import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { ClientWithServices } from '@/features/opportunities/commercial-data';
import { useAuth } from '@/features/auth/auth-context';
import { projectStatusLabels, projectStatusTone, taskPriorityLabels, taskPriorityTone } from '@/features/projects/projects-constants';
import { loadLocalProjectWorkspace } from '@/features/projects/projects-data';
import {
  fetchProjectsWorkspace,
  projectsWorkspaceQueryKey,
  type ProjectWorkspaceProject,
  type ProjectWorkspaceTask,
} from '@/features/projects/projects-queries';
import {
  addClientService,
  fetchBillingCycles,
  fetchClientServices,
  fetchServiceCatalog,
  markBillingCyclePaid,
  servicesQueryKey,
} from '@/features/services/services-queries';
import { initialServiceCatalog } from '@/features/services/services-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatBrl } from '@/lib/formatters/brl';
import type { BillingCycle, ClientService } from '@/types/database';

type Tab = 'geral' | 'servicos' | 'faturas';

type ClientDetailsModalProps = {
  clientWithServices: ClientWithServices;
  onClose: () => void;
};

function formatDate(value: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('pt-BR');
}

function getServiceName(
  service: Pick<ClientService, 'service_catalog_id'>,
  catalog = initialServiceCatalog,
) {
  const catalogItem = catalog.find((item) => item.id === service.service_catalog_id);
  return catalogItem?.name ?? 'Servico';
}

function BillingStatusBadge({ status }: { status: BillingCycle['status'] }) {
  const config: Record<
    BillingCycle['status'],
    { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }
  > = {
    paid: { label: 'Pago', tone: 'success' },
    pending: { label: 'Pendente', tone: 'warning' },
    late: { label: 'Atrasado', tone: 'danger' },
    exempt: { label: 'Isento', tone: 'neutral' },
  };
  const item = config[status];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

function ServiceStatusBadge({ status }: { status: ClientService['status'] }) {
  const config: Record<
    ClientService['status'],
    { label: string; tone: 'success' | 'warning' | 'neutral' }
  > = {
    active: { label: 'Ativo', tone: 'success' },
    paused: { label: 'Pausado', tone: 'warning' },
    closed: { label: 'Encerrado', tone: 'neutral' },
  };
  const item = config[status];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

export function ClientDetailsModal({
  clientWithServices: client,
  onClose,
}: ClientDetailsModalProps) {
  const { isSupabaseConfigured, user } = useAuth();
  const queryClient = useQueryClient();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';

  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [localServices, setLocalServices] = useState(client.services);
  const [localCycles, setLocalCycles] = useState(client.billingCycles);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [addServiceCatalogId, setAddServiceCatalogId] = useState('');
  const [addServicePrice, setAddServicePrice] = useState('');
  const [addServiceBillingDay, setAddServiceBillingDay] = useState('5');

  const catalogQuery = useQuery({
    queryKey: servicesQueryKey,
    queryFn: fetchServiceCatalog,
    enabled: hasRealSession,
  });

  const servicesQuery = useQuery({
    queryKey: ['client-services', client.account.id],
    queryFn: () => fetchClientServices(client.account.id),
    enabled: hasRealSession,
  });

  const billingQuery = useQuery({
    queryKey: ['client-billing-cycles', client.account.id],
    queryFn: () => fetchBillingCycles(client.account.id),
    enabled: hasRealSession,
  });
  const projectsQuery = useQuery({
    queryKey: projectsWorkspaceQueryKey,
    queryFn: fetchProjectsWorkspace,
    enabled: hasRealSession,
  });

  const catalog = useMemo(
    () => (hasRealSession ? (catalogQuery.data ?? []) : initialServiceCatalog),
    [catalogQuery.data, hasRealSession],
  );
  const localProjectWorkspace = useMemo(() => {
    const workspace = loadLocalProjectWorkspace();
    const taskSummaryByProjectId = new Map<string, { done: number; total: number }>();

    for (const task of workspace.tasks) {
      const summary = taskSummaryByProjectId.get(task.project_id) ?? { done: 0, total: 0 };
      summary.total += 1;
      if (task.status === 'done') {
        summary.done += 1;
      }
      taskSummaryByProjectId.set(task.project_id, summary);
    }

    const projects: ProjectWorkspaceProject[] = workspace.projects.map((project) => {
      const summary = taskSummaryByProjectId.get(project.id) ?? { done: 0, total: 0 };
      const accountName =
        workspace.accounts.find((account) => account.id === project.account_id)?.display_name ??
        'Cliente sem nome';

      return {
        ...project,
        accountName,
        completedTaskCount: summary.done,
        taskCount: summary.total,
      };
    });

    const projectById = new Map(projects.map((project) => [project.id, project]));

    const tasks: ProjectWorkspaceTask[] = workspace.tasks.map((task) => {
      const project = projectById.get(task.project_id);
      return {
        ...task,
        accountName: project?.accountName ?? 'Cliente sem nome',
        projectStatus: project?.status ?? 'planned',
        projectTitle: project?.title ?? 'Projeto sem titulo',
      };
    });

    return { accounts: workspace.accounts, projects, tasks };
  }, []);
  const services = hasRealSession ? (servicesQuery.data ?? []) : localServices;
  const billingCycles = hasRealSession ? (billingQuery.data ?? []) : localCycles;
  const projectWorkspace = hasRealSession
    ? (projectsQuery.data ?? { accounts: [], projects: [], tasks: [] })
    : localProjectWorkspace;
  const selectedCatalogService = catalog.find((item) => item.id === addServiceCatalogId);
  const selectedRecurrence = selectedCatalogService?.recurrence ?? 'monthly';
  const pendingCount = billingCycles.filter(
    (cycle) => cycle.status === 'pending' || cycle.status === 'late',
  ).length;
  const monthlyRevenue = services
    .filter((service) => service.status === 'active' && service.recurrence === 'monthly')
    .reduce((acc, service) => acc + Number(service.contracted_price), 0);
  const totalContracted = services
    .filter((service) => service.status === 'active')
    .reduce((acc, service) => acc + Number(service.contracted_price), 0);
  const activeServicesCount = services.filter((service) => service.status === 'active').length;
  const isLoadingOperations = hasRealSession && (servicesQuery.isFetching || billingQuery.isFetching);
  const clientProjects = useMemo(
    () => projectWorkspace.projects.filter((project) => project.account_id === client.account.id),
    [client.account.id, projectWorkspace.projects],
  );
  const clientTasks = useMemo(
    () =>
      projectWorkspace.tasks.filter(
        (task): task is ProjectWorkspaceTask =>
          clientProjects.some((project) => project.id === task.project_id),
      ),
    [clientProjects, projectWorkspace.tasks],
  );
  const pendingTasks = clientTasks.filter((task) => task.status !== 'done');
  const activeProjectsCount = clientProjects.filter((project) => project.status === 'active').length;

  const addServiceMutation = useMutation({
    mutationFn: addClientService,
    onSuccess: (newService) => {
      queryClient.setQueryData<ClientService[]>(['client-services', client.account.id], (current) =>
        current ? [newService, ...current.filter((item) => item.id !== newService.id)] : [newService],
      );
      toast.success('Servico adicionado ao cliente!');
      setShowAddService(false);
      resetAddServiceForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const markBillingCyclePaidMutation = useMutation({
    mutationFn: markBillingCyclePaid,
    onSuccess: (_, billingCycleId) => {
      queryClient.setQueryData<BillingCycle[]>(
        ['client-billing-cycles', client.account.id],
        (current) =>
          current?.map((cycle) =>
            cycle.id === billingCycleId
              ? { ...cycle, status: 'paid', paid_at: new Date().toISOString() }
              : cycle,
          ) ?? [],
      );
      toast.success('Cobranca marcada como paga!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function resetAddServiceForm() {
    setAddServiceCatalogId('');
    setAddServicePrice('');
    setAddServiceBillingDay('5');
  }

  function handleAddServiceLocal() {
    const price = Number(addServicePrice);
    if (!addServiceCatalogId || Number.isNaN(price) || price <= 0) {
      toast.error('Selecione um servico e informe um valor valido.');
      return;
    }

    const newService: ClientService = {
      id: crypto.randomUUID(),
      organization_id: 'org-arroba-local',
      account_id: client.account.id,
      service_catalog_id: addServiceCatalogId,
      status: 'active',
      contracted_price: price,
      recurrence: selectedRecurrence,
      billing_day: selectedRecurrence === 'monthly' ? Number(addServiceBillingDay) : null,
      valid_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: null,
    };

    setLocalServices((current) => [...current, newService]);
    setShowAddService(false);
    resetAddServiceForm();
    toast.success('Servico adicionado localmente!');
  }

  function handleAddService() {
    if (!addServiceCatalogId) {
      toast.error('Selecione um servico do catalogo.');
      return;
    }

    if (hasRealSession) {
      addServiceMutation.mutate({
        accountId: client.account.id,
        serviceCatalogId: addServiceCatalogId,
        contractedPrice: Number(addServicePrice),
        recurrence: selectedRecurrence,
        billingDay: selectedRecurrence === 'monthly' ? Number(addServiceBillingDay) : null,
      });
      return;
    }

    handleAddServiceLocal();
  }

  function handleMarkAsPaid(cycleId: string) {
    setPayingId(cycleId);

    if (hasRealSession) {
      markBillingCyclePaidMutation.mutate(cycleId, {
        onSettled: () => setPayingId(null),
      });
      return;
    }

    setTimeout(() => {
      setLocalCycles((current) =>
        current.map((cycle) =>
          cycle.id === cycleId
            ? { ...cycle, status: 'paid', paid_at: new Date().toISOString() }
            : cycle,
        ),
      );
      setPayingId(null);
      toast.success('Cobranca marcada como paga!');
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-md border border-border bg-card shadow-xl"
        role="dialog"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{client.account.display_name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cliente desde {formatDate(client.account.created_at)}
            </p>
            {isLoadingOperations ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="animate-spin" size={12} />
                Atualizando servicos e faturas
              </p>
            ) : null}
          </div>
          <Button
            className="h-8 w-8 px-0"
            type="button"
            title="Fechar"
            variant="ghost"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        <div className="flex shrink-0 gap-6 overflow-x-auto border-b border-border px-5 text-sm">
          {(['geral', 'servicos', 'faturas'] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`whitespace-nowrap border-b-2 py-3 font-medium transition-colors ${
                activeTab === tab
                  ? 'border-brand text-brand'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'geral' ? 'Geral' : tab === 'servicos' ? 'Servicos' : 'Faturas'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'geral' ? (
            <div className="space-y-6">
              <section>
                <h3 className="mb-3 text-sm font-semibold">Informacoes de contato</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Contato principal</p>
                    <p className="mt-1 text-sm font-medium">{client.contact.full_name}</p>
                    {client.contact.whatsapp ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        WA: {client.contact.whatsapp}
                      </p>
                    ) : null}
                    {client.contact.email ? (
                      <p className="mt-1 text-sm text-muted-foreground">{client.contact.email}</p>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Endereco / unidade sede</p>
                    <p className="mt-1 text-sm font-medium">
                      {client.account.city} - {client.account.state}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold">Resumo financeiro</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">MRR (servicos mensais)</p>
                    <p className="mt-1 text-lg font-bold data-tabular">{formatBrl(monthlyRevenue)}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total contratado</p>
                    <p className="mt-1 text-lg font-bold data-tabular">{formatBrl(totalContracted)}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Servicos ativos</p>
                    <p className="mt-1 text-lg font-bold data-tabular">{activeServicesCount}</p>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Projetos e execucao</h3>
                  {projectsQuery.isFetching ? (
                    <Badge tone="neutral">
                      <Loader2 className="mr-1 animate-spin" size={12} />
                      Atualizando
                    </Badge>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Projetos do cliente</p>
                    <p className="mt-1 text-lg font-bold data-tabular">{clientProjects.length}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Projetos ativos</p>
                    <p className="mt-1 text-lg font-bold data-tabular">{activeProjectsCount}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Tarefas pendentes</p>
                    <p className="mt-1 text-lg font-bold data-tabular">{pendingTasks.length}</p>
                  </div>
                </div>

                {clientProjects.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {clientProjects.slice(0, 3).map((project) => (
                      <div
                        key={project.id}
                        className="rounded-md border border-border p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{project.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {project.description || 'Sem contexto adicional.'}
                            </p>
                          </div>
                          <Badge tone={projectStatusTone(project.status)}>
                            {projectStatusLabels[project.status]}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {project.completedTaskCount}/{project.taskCount} tarefa(s) concluidas
                          </span>
                          <span>Prazo: {formatDate(project.due_date)}</span>
                        </div>
                      </div>
                    ))}
                    {pendingTasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="rounded-md border border-dashed border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{task.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{task.projectTitle}</p>
                          </div>
                          <Badge tone={taskPriorityTone(task.priority)}>
                            {taskPriorityLabels[task.priority]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Nenhum projeto vinculado a este cliente ainda.
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === 'servicos' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Servicos contratados</h3>
                <Button
                  variant="secondary"
                  className="h-8 text-xs"
                  onClick={() => setShowAddService(true)}
                  disabled={showAddService}
                >
                  <Plus size={14} className="mr-1" />
                  Adicionar servico
                </Button>
              </div>

              {showAddService ? (
                <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
                  <h4 className="text-sm font-semibold">Novo servico contratado</h4>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Servico do catalogo
                    </span>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      value={addServiceCatalogId}
                      onChange={(event) => {
                        const item = catalog.find((service) => service.id === event.target.value);
                        setAddServiceCatalogId(event.target.value);
                        if (item) setAddServicePrice(String(item.default_price));
                      }}
                    >
                      <option value="">Selecione um servico...</option>
                      {catalog.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({formatBrl(item.default_price)} -{' '}
                          {item.recurrence === 'monthly' ? 'Mensal' : 'Avulso'})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground">
                        Valor contratado (R$)
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={addServicePrice}
                        onChange={(event) => setAddServicePrice(event.target.value)}
                      />
                    </label>

                    {selectedRecurrence === 'monthly' ? (
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-muted-foreground">
                          Dia de vencimento
                        </span>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={addServiceBillingDay}
                          onChange={(event) => setAddServiceBillingDay(event.target.value)}
                        />
                      </label>
                    ) : null}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="secondary"
                      className="h-8 text-xs"
                      onClick={() => {
                        setShowAddService(false);
                        resetAddServiceForm();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="h-8 text-xs"
                      disabled={addServiceMutation.isPending}
                      onClick={handleAddService}
                    >
                      {addServiceMutation.isPending ? (
                        <Loader2 className="mr-1 animate-spin" size={14} />
                      ) : (
                        <Plus size={14} className="mr-1" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : null}

              {services.length > 0 ? (
                <div className="space-y-3">
                  {services.map((service) => (
                    <div key={service.id} className="rounded-md border border-border p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{getServiceName(service, catalog)}</h4>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {service.recurrence === 'monthly' ? 'Mensal' : 'Avulso'}
                            {service.billing_day ? ` - Vencimento dia ${service.billing_day}` : ''}
                          </p>
                        </div>
                        <ServiceStatusBadge status={service.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-lg font-bold data-tabular">
                          {formatBrl(Number(service.contracted_price))}
                        </span>
                        {service.valid_until ? (
                          <span className="text-xs text-muted-foreground">
                            Valido ate {formatDate(service.valid_until)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 text-muted-foreground/50" size={24} />
                  Nenhum servico contratado no momento.
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'faturas' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Ciclos de cobranca</h3>
                {pendingCount > 0 ? (
                  <Badge tone="danger">{pendingCount} pendente(s)</Badge>
                ) : (
                  <Badge tone="success">Em dia</Badge>
                )}
              </div>

              {billingCycles.length > 0 ? (
                <div className="space-y-3">
                  {billingCycles.map((cycle) => {
                    const relatedService =
                      services.find((service) => service.id === cycle.client_service_id) ?? null;

                    return (
                      <div key={cycle.id} className="rounded-md border border-border p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-semibold">
                              {relatedService
                                ? getServiceName(relatedService, catalog)
                                : 'Servico vinculado'}
                            </h4>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Ref. {formatDate(cycle.reference_month)} - Vence{' '}
                              {formatDate(cycle.due_date)}
                            </p>
                          </div>
                          <BillingStatusBadge status={cycle.status} />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-lg font-bold data-tabular">
                            {formatBrl(Number(cycle.amount))}
                          </span>
                          <div className="flex items-center gap-2">
                            {cycle.paid_at ? (
                              <span className="text-xs text-muted-foreground">
                                Pago em {formatDate(cycle.paid_at)}
                              </span>
                            ) : null}
                            {cycle.status === 'pending' || cycle.status === 'late' ? (
                              <Button
                                variant="success"
                                className="h-8 px-3 text-xs"
                                disabled={payingId === cycle.id}
                                onClick={() => handleMarkAsPaid(cycle.id)}
                              >
                                {payingId === cycle.id ? (
                                  <Loader2 className="mr-1 animate-spin" size={14} />
                                ) : (
                                  <CheckCircle2 className="mr-1" size={14} />
                                )}
                                {payingId === cycle.id ? 'Confirmando...' : 'Pago'}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 text-muted-foreground/50" size={24} />
                  Nenhum ciclo de cobranca encontrado.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
