import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  FolderKanban,
  Handshake,
  Loader2,
  RefreshCcw,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';
import {
  type CommercialLead,
  initialCommercialLeads,
  pipelineStages,
} from '@/features/opportunities/commercial-data';
import {
  commercialQueryKey,
  fetchCommercialData,
} from '@/features/opportunities/commercial-queries';
import { loadLocalProjectWorkspace } from '@/features/projects/projects-data';
import {
  fetchProjectsWorkspace,
  projectsWorkspaceQueryKey,
} from '@/features/projects/projects-queries';
import {
  dashboardFinancialsKey,
  fetchDashboardFinancials,
  type DashboardFinancials,
} from './dashboard-queries';
import { formatBrl } from '@/lib/formatters/brl';

function isSameLocalDate(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

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
  financials: DashboardFinancials | null,
  activeProjects: number,
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

  return {
    metrics: [
      {
        label: 'Leads abertos',
        value: String(openLeads.length),
        icon: Handshake,
        tone: 'brand' as const,
      },
      {
        label: 'Clientes ativos',
        value: String(activeClientIds.size),
        icon: UsersRound,
        tone: 'success' as const,
      },
      {
        label: 'Projetos ativos',
        value: String(activeProjects),
        icon: FolderKanban,
        tone: 'neutral' as const,
      },
      {
        label: 'Valor em aberto',
        value: formatBrl(
          openLeads.reduce((total, lead) => total + (lead.opportunity.estimated_value ?? 0), 0),
        ),
        icon: Handshake,
        tone: 'neutral' as const,
      },
      {
        label: 'MRR',
        value: formatBrl(financials?.mrr ?? 0),
        icon: CircleDollarSign,
        tone: 'success' as const,
      },
    ],
    priorities: [
      {
        title: 'Follow-ups vencidos',
        value: String(overdueFollowUps.length),
        icon: AlertTriangle,
        tone: overdueFollowUps.length > 0 ? ('danger' as const) : ('neutral' as const),
      },
      {
        title: 'Follow-ups hoje',
        value: String(todayFollowUps.length),
        icon: CalendarClock,
        tone: 'brand' as const,
      },
      {
        title: 'Próximos follow-ups',
        value: String(nextFollowUps.length),
        icon: RefreshCcw,
        tone: 'warning' as const,
      },
      {
        title: 'Oportunidades totais',
        value: String(leads.length),
        icon: FolderKanban,
        tone: 'neutral' as const,
      },
      {
        title: 'Faturas atrasadas',
        value: String(financials?.lateInvoices ?? 0),
        icon: AlertTriangle,
        tone: (financials?.lateInvoices ?? 0) > 0 ? ('danger' as const) : ('neutral' as const),
      },
      {
        title: 'Faturas pendentes',
        value: String(financials?.pendingInvoices ?? 0),
        icon: CalendarClock,
        tone: 'neutral' as const,
      },
    ],
    nextFollowUps,
  };
}

export function DashboardPage() {
  const { isSupabaseConfigured, user } = useAuth();
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

  const leads = hasRealSession ? (commercialQuery.data?.leads ?? []) : initialCommercialLeads;
  const stages = commercialQuery.data?.stages.length ? commercialQuery.data.stages : pipelineStages;
  const localProjects = hasRealSession ? [] : loadLocalProjectWorkspace().projects;
  const activeProjects = hasRealSession
    ? (projectsQuery.data?.projects ?? []).filter((project) => project.status === 'active').length
    : localProjects.filter((project) => project.status === 'active').length;
  const dashboard = buildDashboard(leads, financialsQuery.data ?? null, activeProjects, stages);

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
              <p className="font-semibold">Não foi possível carregar o dashboard.</p>
              <p className="mt-1 text-danger/80">{commercialQuery.error.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                <p className="text-sm text-muted-foreground">Follow-ups e pressão comercial.</p>
              </div>
              <Badge tone={hasRealSession ? 'success' : 'neutral'}>
                {hasRealSession ? 'Supabase' : 'Local'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {dashboard.priorities.map((item) => (
                <div key={item.title} className="rounded-md border border-border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <Badge tone={item.tone}>{item.title}</Badge>
                    <item.icon className="text-muted-foreground" size={18} />
                  </div>
                  <p className="text-3xl font-bold data-tabular">{item.value}</p>
                </div>
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
    </div>
  );
}

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  tone: 'brand' | 'success' | 'neutral' | 'warning' | 'danger';
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
