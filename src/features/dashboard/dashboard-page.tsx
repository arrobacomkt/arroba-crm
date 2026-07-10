import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  FileText,
  FolderKanban,
  Handshake,
  Loader2,
  RefreshCcw,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';
import {
  alertKindLabel,
  buildOperationalAlerts,
  deriveLocalFinancials,
  isSameLocalDate,
  routeForAlert,
  startOfToday,
  type AutomationAlert,
  type FinancialSnapshot,
} from '@/features/operations/alerts';
import {
  initialBillingCycles,
  initialClientServices,
  type CommercialLead,
  initialCommercialLeads,
  pipelineStages,
} from '@/features/opportunities/commercial-data';
import {
  commercialQueryKey,
  fetchCommercialData,
} from '@/features/opportunities/commercial-queries';
import { loadLocalDocumentWorkspace } from '@/features/documents/documents-data';
import {
  documentStatusLabels,
  documentStatusTone,
} from '@/features/documents/documents-constants';
import {
  documentsWorkspaceQueryKey,
  fetchDocumentsWorkspace,
} from '@/features/documents/documents-queries';
import { loadLocalProjectWorkspace } from '@/features/projects/projects-data';
import {
  fetchProjectsWorkspace,
  projectsWorkspaceQueryKey,
  type ProjectWorkspaceProject,
  type ProjectWorkspaceTask,
} from '@/features/projects/projects-queries';
import { formatBrl } from '@/lib/formatters/brl';

import { dashboardFinancialsKey, fetchDashboardFinancials } from './dashboard-queries';

function formatFollowUp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildDashboard(
  leads: CommercialLead[],
  financials: FinancialSnapshot | null,
  projects: ProjectWorkspaceProject[],
  tasks: ProjectWorkspaceTask[],
  stages = pipelineStages,
) {
  const openStageIds = new Set(
    stages.filter((stage) => stage.stage_group === 'open').map((stage) => stage.id),
  );
  const openLeads = leads.filter((lead) => openStageIds.has(lead.opportunity.pipeline_stage_id));
  const activeClientIds = new Set(
    leads
      .filter(
        (lead) => lead.account.lifecycle_status === 'client' && lead.account.status === 'active',
      )
      .map((lead) => lead.account.id),
  );
  const todayStart = startOfToday();
  const now = new Date();
  const followUps = leads
    .filter((lead) => Boolean(lead.opportunity.next_follow_up_at))
    .map((lead) => ({
      lead,
      date: new Date(lead.opportunity.next_follow_up_at ?? ''),
    }))
    .filter((item) => !Number.isNaN(item.date.getTime()));
  const overdueFollowUps = followUps.filter((item) => item.date < todayStart);
  const todayFollowUps = followUps.filter((item) => isSameLocalDate(item.date, now));
  const nextFollowUps = followUps
    .filter((item) => item.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 4);
  const activeProjects = projects.filter((project) => project.status === 'active').length;
  const alerts = buildOperationalAlerts({ leads, projects, tasks, financials });

  return {
    metrics: [
      {
        label: 'Leads abertos',
        value: String(openLeads.length),
        icon: Handshake,
      },
      {
        label: 'Clientes ativos',
        value: String(activeClientIds.size),
        icon: UsersRound,
      },
      {
        label: 'Projetos ativos',
        value: String(activeProjects),
        icon: FolderKanban,
      },
      {
        label: 'Valor em aberto',
        value: formatBrl(
          openLeads.reduce((total, lead) => total + (lead.opportunity.estimated_value ?? 0), 0),
        ),
        icon: Handshake,
      },
      {
        label: 'MRR',
        value: formatBrl(financials?.mrr ?? 0),
        icon: CircleDollarSign,
      },
    ],
    priorities: [
      {
        title: 'Follow-ups vencidos',
        value: String(overdueFollowUps.length),
        icon: AlertTriangle,
        tone: overdueFollowUps.length > 0 ? ('danger' as const) : ('neutral' as const),
        route: '/app/comercial/follow-ups?followUp=overdue',
      },
      {
        title: 'Follow-ups hoje',
        value: String(todayFollowUps.length),
        icon: CalendarClock,
        tone: 'brand' as const,
        route: '/app/comercial/follow-ups?followUp=today',
      },
      {
        title: 'Proximos follow-ups',
        value: String(nextFollowUps.length),
        icon: RefreshCcw,
        tone: 'warning' as const,
        route: '/app/comercial/follow-ups?followUp=upcoming',
      },
      {
        title: 'Oportunidades totais',
        value: String(leads.length),
        icon: FolderKanban,
        tone: 'neutral' as const,
        route: '/app/comercial/oportunidades',
      },
      {
        title: 'Faturas atrasadas',
        value: String(financials?.lateInvoices ?? 0),
        icon: AlertTriangle,
        tone: (financials?.lateInvoices ?? 0) > 0 ? ('danger' as const) : ('neutral' as const),
        route: '/app/calendario?kind=billing&focus=critical',
      },
      {
        title: 'Tarefas atrasadas',
        value: String(alerts.counts.overdueTasks),
        icon: AlertTriangle,
        tone: alerts.counts.overdueTasks > 0 ? ('danger' as const) : ('neutral' as const),
        route: '/app/tarefas/lista?timing=overdue',
      },
    ],
    automationSummary: {
      criticalAlerts: alerts.criticalAlerts,
      dueSoonAlerts: alerts.dueSoonAlerts,
    },
    nextFollowUps,
  };
}

export function DashboardPage() {
  const { isSupabaseConfigured, user } = useAuth();
  const navigate = useNavigate();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';

  const commercialQuery = useQuery({
    queryKey: commercialQueryKey,
    queryFn: fetchCommercialData,
    enabled: hasRealSession,
  });

  const financialsQuery = useQuery({
    queryKey: dashboardFinancialsKey,
    queryFn: fetchDashboardFinancials,
    enabled: hasRealSession,
  });

  const projectsQuery = useQuery({
    queryKey: projectsWorkspaceQueryKey,
    queryFn: fetchProjectsWorkspace,
    enabled: hasRealSession,
  });
  const documentsQuery = useQuery({
    queryKey: documentsWorkspaceQueryKey,
    queryFn: fetchDocumentsWorkspace,
    enabled: hasRealSession,
  });

  const leads = hasRealSession ? (commercialQuery.data?.leads ?? []) : initialCommercialLeads;
  const stages = commercialQuery.data?.stages.length ? commercialQuery.data.stages : pipelineStages;
  const localProjectWorkspace = hasRealSession ? null : loadLocalProjectWorkspace();
  const localDocumentsWorkspace = hasRealSession ? null : loadLocalDocumentWorkspace();

  const projects = hasRealSession
    ? (projectsQuery.data?.projects ?? [])
    : ((localProjectWorkspace?.projects.map((project) => ({
        ...project,
        accountName:
          localProjectWorkspace?.accounts.find((account) => account.id === project.account_id)
            ?.display_name ?? 'Cliente sem nome',
        completedTaskCount: (localProjectWorkspace?.tasks ?? []).filter(
          (task) => task.project_id === project.id && task.status === 'done',
        ).length,
        taskCount: (localProjectWorkspace?.tasks ?? []).filter(
          (task) => task.project_id === project.id,
        ).length,
      })) ?? []) as ProjectWorkspaceProject[]);

  const tasks = hasRealSession
    ? (projectsQuery.data?.tasks ?? [])
    : ((localProjectWorkspace?.tasks.map((task) => {
        const project = localProjectWorkspace?.projects.find((item) => item.id === task.project_id);
        const accountName = project
          ? (localProjectWorkspace?.accounts.find((account) => account.id === project.account_id)
              ?.display_name ?? 'Cliente sem nome')
          : 'Cliente sem nome';

        return {
          ...task,
          accountName,
          projectStatus: project?.status ?? 'planned',
          projectTitle: project?.title ?? 'Projeto sem titulo',
        };
      }) ?? []) as ProjectWorkspaceTask[]);

  const financials = hasRealSession
    ? (financialsQuery.data ?? null)
    : deriveLocalFinancials(initialClientServices, initialBillingCycles);
  const documents = hasRealSession
    ? (documentsQuery.data?.documents ?? [])
    : (localDocumentsWorkspace?.documents.map((document) => ({
        ...document,
        accountName:
          localDocumentsWorkspace?.accounts.find((account) => account.id === document.account_id)
            ?.display_name ?? null,
        projectTitle:
          localDocumentsWorkspace?.projects.find((project) => project.id === document.project_id)
            ?.title ?? null,
      })) ?? []);
  const reviewDocuments = documents
    .filter((document) => document.status === 'draft' || document.status === 'in_review')
    .sort((first, second) => new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime())
    .slice(0, 4);

  const dashboard = buildDashboard(leads, financials, projects, tasks, stages);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prioridades comerciais e operacionais do dia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {commercialQuery.isFetching ? (
            <Badge tone="neutral">
              <Loader2 className="mr-1 animate-spin" size={13} />
              Atualizando
            </Badge>
          ) : null}
          <Badge tone="brand">{hasRealSession ? 'M4 Operacao' : 'Modo local'}</Badge>
        </div>
      </div>

      {hasRealSession && commercialQuery.isError ? (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="flex gap-3 p-4 text-sm text-danger">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold">Nao foi possivel carregar o dashboard.</p>
              <p className="mt-1 text-danger/80">{commercialQuery.error.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {dashboard.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Prioridades</h2>
                <p className="text-sm text-muted-foreground">Follow-ups e pressao comercial.</p>
              </div>
              <Badge tone={hasRealSession ? 'success' : 'neutral'}>
                {hasRealSession ? 'Supabase' : 'Local'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {dashboard.priorities.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className="rounded-md border border-border p-4 text-left transition-colors hover:border-brand/40 hover:bg-muted/30"
                  onClick={() => navigate(item.route)}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <Badge tone={item.tone}>{item.title}</Badge>
                    <item.icon className="text-muted-foreground" size={18} />
                  </div>
                  <p className="text-3xl font-bold data-tabular">{item.value}</p>
                  <p className="mt-3 text-xs font-medium text-muted-foreground">Abrir modulo</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Agenda comercial</h2>
          </CardHeader>
          <CardContent>
            {dashboard.nextFollowUps.length > 0 ? (
              <div className="space-y-3">
                {dashboard.nextFollowUps.map(({ lead, date }) => (
                  <div key={lead.opportunity.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-semibold">{lead.account.display_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{lead.opportunity.title}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Badge tone="warning">{formatFollowUp(date.toISOString())}</Badge>
                      <span className="text-xs font-semibold data-tabular">
                        {formatBrl(lead.opportunity.estimated_value ?? 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nenhum follow-up futuro agendado.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Alertas criticos</h2>
                <p className="text-sm text-muted-foreground">
                  Itens vencidos ou com maior risco operacional.
                </p>
              </div>
              <Badge
                tone={dashboard.automationSummary.criticalAlerts.length > 0 ? 'danger' : 'success'}
              >
                {dashboard.automationSummary.criticalAlerts.length} alerta(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {dashboard.automationSummary.criticalAlerts.length > 0 ? (
              <div className="space-y-3">
                {dashboard.automationSummary.criticalAlerts.map((alert) => (
                  <AutomationAlertCard
                    key={`${alert.kind}-${alert.title}-${alert.target}`}
                    alert={alert}
                    onOpen={() => navigate(routeForAlert(alert))}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nenhum alerta critico no momento.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Vencendo em breve</h2>
                <p className="text-sm text-muted-foreground">
                  Proximos follow-ups, tarefas e prazos para organizar a semana.
                </p>
              </div>
              <Badge tone="warning">
                {dashboard.automationSummary.dueSoonAlerts.length} item(ns)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {dashboard.automationSummary.dueSoonAlerts.length > 0 ? (
              <div className="space-y-3">
                {dashboard.automationSummary.dueSoonAlerts.map((alert) => (
                  <AutomationAlertCard
                    key={`${alert.kind}-${alert.title}-${alert.target}`}
                    alert={alert}
                    onOpen={() => navigate(routeForAlert(alert))}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Sem pendencias proximas para acompanhar.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Fila editorial</h2>
              <p className="text-sm text-muted-foreground">
                Documentos que ainda pedem revisao ou fechamento.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {documentsQuery.isFetching ? (
                <Badge tone="neutral">
                  <Loader2 className="mr-1 animate-spin" size={13} />
                  Atualizando
                </Badge>
              ) : null}
              <Badge tone={reviewDocuments.length > 0 ? 'warning' : 'success'}>
                {reviewDocuments.length} item(ns)
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reviewDocuments.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-4">
              {reviewDocuments.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  className="rounded-md border border-border p-4 text-left transition-colors hover:border-brand/40 hover:bg-muted/30"
                  onClick={() => navigate('/app/documentos')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={documentStatusTone(document.status)}>
                      {documentStatusLabels[document.status]}
                    </Badge>
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-muted text-brand">
                      <FileText size={16} />
                    </div>
                  </div>
                  <p className="mt-3 font-semibold">{document.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {document.accountName ?? 'Sem cliente vinculado'}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Atualizado em {formatFollowUp(document.updated_at)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhum documento em revisao neste momento.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

function MetricCard({ icon: Icon, label, value }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold data-tabular">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
          <Icon size={20} />
        </div>
      </CardContent>
    </Card>
  );
}

function AutomationAlertCard({ alert, onOpen }: { alert: AutomationAlert; onOpen: () => void }) {
  return (
    <article className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{alert.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{alert.target}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={alert.tone}>{alert.dueLabel}</Badge>
          <Badge tone="neutral">{alertKindLabel(alert.kind)}</Badge>
        </div>
      </div>
      <div className="mt-3">
        <Button type="button" variant="secondary" onClick={onOpen}>
          Abrir modulo
        </Button>
      </div>
    </article>
  );
}
