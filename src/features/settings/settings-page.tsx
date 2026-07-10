import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  FolderKanban,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  UserRoundCheck,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { settingsTabs } from '@/app/module-tabs-config';
import { ModulePageLayout } from '@/components/layout/module-page-layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/app/theme-context';
import {
  dashboardFinancialsKey,
  fetchDashboardFinancials,
} from '@/features/dashboard/dashboard-queries';
import { loadLocalDocumentWorkspace } from '@/features/documents/documents-data';
import {
  documentsWorkspaceQueryKey,
  fetchDocumentsWorkspace,
} from '@/features/documents/documents-queries';
import {
  buildOperationalAlerts,
  deriveLocalFinancials,
} from '@/features/operations/alerts';
import {
  initialBillingCycles,
  initialClientServices,
  initialCommercialLeads,
} from '@/features/opportunities/commercial-data';
import {
  commercialQueryKey,
  fetchCommercialData,
} from '@/features/opportunities/commercial-queries';
import { loadLocalProjectWorkspace } from '@/features/projects/projects-data';
import {
  fetchProjectsWorkspace,
  projectsWorkspaceQueryKey,
  type ProjectWorkspaceProject,
  type ProjectWorkspaceTask,
} from '@/features/projects/projects-queries';

const internalUsers = [
  {
    name: 'Davi',
    role: 'owner',
    scope: 'Estrategia, comercial, atendimento e producao audiovisual',
  },
  {
    name: 'Richards',
    role: 'owner',
    scope: 'Design, edicao, identidade visual e automacoes futuras',
  },
] as const;

const securityChecks = [
  'Cadastro publico desativado no MVP',
  'Perfis criados por trigger a partir de auth.users',
  'RLS inicial habilitado nas tabelas base',
  'Helpers current_org_ids, is_org_member e is_org_owner versionados',
  'Protecao contra remocao do ultimo owner ativo',
] as const;

const moduleStatus = [
  {
    name: 'Dashboard',
    summary: 'Pulso operacional, alertas e atalhos entre modulos.',
    route: '/app/dashboard',
  },
  {
    name: 'Leads e pipeline',
    summary: 'Pipeline comercial, follow-ups, conversao e filtros operacionais.',
    route: '/app/comercial/pipeline',
  },
  {
    name: 'Clientes',
    summary: 'Carteira ativa com servicos, cobranca e execucao do cliente no mesmo fluxo.',
    route: '/app/clientes/ativos',
  },
  {
    name: 'Projetos e tarefas',
    summary: 'Projetos com tarefas, andamento e filtros de prazo.',
    route: '/app/projetos/ativos',
  },
  {
    name: 'Calendario',
    summary: 'Visao de vencimentos, follow-ups e entregas criticas.',
    route: '/app/calendario',
  },
  {
    name: 'Chat',
    summary: 'Canais internos com lembretes operacionais e organizacao por contexto.',
    route: '/app/chat/gerais',
  },
  {
    name: 'Documentos',
    summary: 'Editor, fila de revisao e autosave prontos para a operacao do MVP.',
    route: '/app/documentos/todos',
  },
  {
    name: 'Catalogo de servicos',
    summary: 'Catalogo com criacao, edicao e ativacao operacional para uso do time.',
    route: '/app/servicos/catalogo',
  },
] as const;

const handoffItems = [
  {
    title: 'MVP entregue',
    summary: 'Fluxos principais aprovados para uso inicial da Arroba Co.',
    tone: 'success' as const,
  },
  {
    title: 'Handoff operacional',
    summary: 'Dashboard, calendario e esta tela viram referencia de acompanhamento.',
    tone: 'brand' as const,
  },
  {
    title: 'Pos-MVP opcional',
    summary: 'Polimentos finos, anexos e expansoes podem entrar na proxima rodada.',
    tone: 'neutral' as const,
  },
] as const;

type LiveIssue = {
  id: string;
  label: string;
  route: string;
  tone: 'warning' | 'danger' | 'brand';
};

export function SettingsPage() {
  const location = useLocation();
  const { isSupabaseConfigured, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';

  const commercialQuery = useQuery({
    queryKey: commercialQueryKey,
    queryFn: fetchCommercialData,
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
  const financialsQuery = useQuery({
    queryKey: dashboardFinancialsKey,
    queryFn: fetchDashboardFinancials,
    enabled: hasRealSession,
  });

  const localProjectWorkspace = useMemo(() => loadLocalProjectWorkspace(), []);
  const localDocumentWorkspace = useMemo(() => loadLocalDocumentWorkspace(), []);

  const leads = hasRealSession ? (commercialQuery.data?.leads ?? []) : initialCommercialLeads;
  const projects = hasRealSession
    ? (projectsQuery.data?.projects ?? [])
    : ((localProjectWorkspace.projects.map((project) => ({
        ...project,
        accountName:
          localProjectWorkspace.accounts.find((account) => account.id === project.account_id)
            ?.display_name ?? 'Cliente sem nome',
        completedTaskCount: localProjectWorkspace.tasks.filter(
          (task) => task.project_id === project.id && task.status === 'done',
        ).length,
        taskCount: localProjectWorkspace.tasks.filter((task) => task.project_id === project.id)
          .length,
      })) ?? []) as ProjectWorkspaceProject[]);
  const tasks = hasRealSession
    ? (projectsQuery.data?.tasks ?? [])
    : ((localProjectWorkspace.tasks.map((task) => {
        const project = localProjectWorkspace.projects.find((item) => item.id === task.project_id);
        const accountName = project
          ? (localProjectWorkspace.accounts.find((account) => account.id === project.account_id)
              ?.display_name ?? 'Cliente sem nome')
          : 'Cliente sem nome';

        return {
          ...task,
          accountName,
          projectStatus: project?.status ?? 'planned',
          projectTitle: project?.title ?? 'Projeto sem titulo',
        };
      }) ?? []) as ProjectWorkspaceTask[]);
  const documents = hasRealSession
    ? (documentsQuery.data?.documents ?? [])
    : localDocumentWorkspace.documents.map((document) => ({
        ...document,
        accountName:
          localDocumentWorkspace.accounts.find((account) => account.id === document.account_id)
            ?.display_name ?? null,
        projectTitle:
          localDocumentWorkspace.projects.find((project) => project.id === document.project_id)
            ?.title ?? null,
      }));
  const financials = hasRealSession
    ? (financialsQuery.data ?? null)
    : deriveLocalFinancials(initialClientServices, initialBillingCycles);

  const alerts = buildOperationalAlerts({ leads, projects, tasks, financials });
  const documentsInReview = documents.filter((document) => document.status === 'in_review').length;
  const draftDocuments = documents.filter((document) => document.status === 'draft').length;
  const activeProjects = projects.filter((project) => project.status === 'active').length;
  const mvpCompletion = 100;

  const liveIssues = useMemo<LiveIssue[]>(() => {
    const items: LiveIssue[] = [];

    for (const alert of alerts.criticalAlerts.slice(0, 3)) {
      items.push({
        id: `alert-${alert.kind}-${alert.title}-${alert.target}`,
        label: `${alert.title} - ${alert.target}`,
        route:
          alert.kind === 'follow_up'
            ? '/app/comercial/follow-ups?followUp=overdue'
            : alert.kind === 'task'
              ? '/app/tarefas/lista?timing=overdue'
              : alert.kind === 'project'
                ? '/app/projetos/ativos?timing=overdue'
                : '/app/calendario?kind=billing&focus=critical',
        tone: alert.tone === 'danger' ? 'danger' : 'warning',
      });
    }

    if (documentsInReview > 0) {
      items.push({
        id: 'documents-review',
        label: `${documentsInReview} documento(s) em revisao`,
        route: '/app/documentos/todos',
        tone: 'warning',
      });
    }

    if (draftDocuments > 0) {
      items.push({
        id: 'documents-draft',
        label: `${draftDocuments} documento(s) em rascunho`,
        route: '/app/documentos/todos',
        tone: 'brand',
      });
    }

    return items.slice(0, 6);
  }, [alerts.criticalAlerts, documentsInReview, draftDocuments]);

  const allSystemsGo = liveIssues.length === 0;
  const settingsTab = location.pathname.split('/').pop() ?? 'geral';
  const showOverview = settingsTab === 'geral';
  const showPipeline = settingsTab === 'pipeline';
  const showCatalog = settingsTab === 'catalogo-servicos';
  const showTemplates = settingsTab === 'modelos';
  const showSecurity = settingsTab === 'seguranca';
  const showAppearance = settingsTab === 'aparencia';
  const showSystem = settingsTab === 'sistema';

  return (
    <ModulePageLayout
      title="Configuracoes"
      description="Organize o workspace por contexto, com cada area em sua propria guia."
      breadcrumbs={[
        { label: 'Configuracoes', to: '/app/configuracoes/geral' },
        { label: settingsTabs.find((tab) => tab.to.endsWith(`/${settingsTab}`))?.label ?? 'Geral' },
      ]}
      tabs={settingsTabs}
      actions={
        <>
          <Badge tone="success">MVP entregue</Badge>
          <Badge tone={hasRealSession ? 'success' : 'warning'}>
            {hasRealSession ? 'Supabase conectado' : 'Modo local'}
          </Badge>
        </>
      }
    >
      {(showOverview || showSystem) ? (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Sparkles}
          label="Status do MVP"
          value="Entregue"
          tone="success"
        />
        <MetricCard
          icon={FolderKanban}
          label="Modulos prontos"
          value={`${moduleStatus.length}/${moduleStatus.length}`}
          tone="success"
        />
        <MetricCard
          icon={Target}
          label="Fechamento"
          value={`${mvpCompletion}%`}
          tone="brand"
        />
        <MetricCard
          icon={LockKeyhole}
          label="Base"
          value={isSupabaseConfigured ? 'Conectada' : 'Local'}
          tone={isSupabaseConfigured ? 'success' : 'warning'}
        />
      </section>
      ) : null}

      {showAppearance ? (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Aparencia</h2>
              <p className="text-sm text-muted-foreground">
                Alterne entre light mode e dark mode conforme a preferencia de uso.
              </p>
            </div>
            <div className="inline-flex rounded-full border border-border bg-muted p-1">
              <button
                type="button"
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                  theme === 'light'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTheme('light')}
              >
                <Sun size={16} />
                Light mode
              </button>
              <button
                type="button"
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                  theme === 'dark'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTheme('dark')}
              >
                <Moon size={16} />
                Dark mode
              </button>
            </div>
          </div>
        </CardHeader>
      </Card>
      ) : null}

      {(showOverview || showPipeline || showSystem) ? (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CircleAlert}
          label="Alertas criticos"
          value={String(alerts.criticalAlerts.length)}
          tone={alerts.criticalAlerts.length > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          icon={Clock3}
          label="Tarefas atrasadas"
          value={String(alerts.counts.overdueTasks)}
          tone={alerts.counts.overdueTasks > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          icon={FileText}
          label="Docs em revisao"
          value={String(documentsInReview)}
          tone={documentsInReview > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          icon={Wrench}
          label="Projetos ativos"
          value={String(activeProjects)}
          tone="brand"
        />
      </section>
      ) : null}

      {(showOverview || showPipeline || showSystem) ? (
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Status de liberacao</h2>
                <p className="text-sm text-muted-foreground">
                  Leitura executiva final do estado do MVP.
                </p>
              </div>
              <Badge tone={allSystemsGo ? 'success' : 'warning'}>
                {allSystemsGo ? 'Liberado' : 'Com acompanhamento'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryPill label="MVP" value="Entregue" />
              <SummaryPill label="Modulos" value="8/8" />
              <SummaryPill label="Pulso vivo" value={allSystemsGo ? 'Limpo' : 'Ativo'} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              O MVP esta entregue e pronto para uso inicial. Ajustes daqui pra frente entram como
              evolucao pos-MVP, nao como pendencia de liberacao.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Pulso vivo do CRM</h2>
                <p className="text-sm text-muted-foreground">
                  O que ainda merece acompanhamento normal de operacao.
                </p>
              </div>
              <Badge tone={hasRealSession ? 'success' : 'neutral'}>
                {hasRealSession ? 'Dados reais' : 'Base local'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {liveIssues.length > 0 ? (
              <div className="space-y-3">
                {liveIssues.map((item) => (
                  <a
                    key={item.id}
                    className="block rounded-md border border-border p-4 transition-colors hover:border-brand/40 hover:bg-muted/30"
                    href={item.route}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{item.label}</p>
                      <Badge tone={item.tone}>
                        {item.tone === 'danger'
                          ? 'Critico'
                          : item.tone === 'warning'
                            ? 'Atencao'
                            : 'Acompanhar'}
                      </Badge>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Sem gargalos relevantes nesta leitura. O CRM esta limpo para a operacao do MVP.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
      ) : null}

      {showOverview ? (
      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Organizacao</h2>
                <p className="text-sm text-muted-foreground">Workspace unico do MVP</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <dt className="text-muted-foreground">Nome</dt>
                <dd className="font-semibold">Arroba Co</dd>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <dt className="text-muted-foreground">Slug</dt>
                <dd className="font-mono text-xs font-semibold">arroba-co</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Timezone</dt>
                <dd className="font-mono text-xs font-semibold">America/Sao_Paulo</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
                <UsersRound size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Usuarios internos</h2>
                <p className="text-sm text-muted-foreground">Ambos seguem como owners no MVP</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {internalUsers.map((item) => (
                <article key={item.name} className="rounded-md border border-border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-brand">
                        <UserRoundCheck size={18} />
                      </div>
                      <h3 className="font-semibold">{item.name}</h3>
                    </div>
                    <Badge tone="brand">{item.role}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.scope}</p>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
      ) : null}

      {(showCatalog || showTemplates || showSystem) ? (
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  {showCatalog ? 'Catalogo e modulos operacionais' : 'Modulos do MVP'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {showTemplates
                    ? 'Bases prontas para reaproveitamento nos proximos ciclos.'
                    : 'Leitura limpa do que ja esta entregue para operacao.'}
                </p>
              </div>
              <Badge tone="success">100% pronto</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {moduleStatus.map((item) => (
                <a
                  key={item.name}
                  className="block rounded-md border border-border p-4 transition-colors hover:border-brand/40 hover:bg-muted/30"
                  href={item.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.summary}
                      </p>
                    </div>
                    <Badge tone="success">Pronto</Badge>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Handoff do MVP</h2>
                <p className="text-sm text-muted-foreground">
                  O que fica combinado a partir desta entrega.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {handoffItems.map((item) => (
                <article key={item.title} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.title}</p>
                    <Badge tone={item.tone}>
                      {item.tone === 'success'
                        ? 'Fechado'
                        : item.tone === 'brand'
                          ? 'Em uso'
                          : 'Pos-MVP'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
      ) : null}

      {showSecurity ? (
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Seguranca e base</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {securityChecks.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-md border border-border p-3">
                <CheckCircle2 className="shrink-0 text-success" size={18} />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      ) : null}
    </ModulePageLayout>
  );
}

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  tone: 'success' | 'warning' | 'brand';
  value: string;
};

function MetricCard({ icon: Icon, label, tone, value }: MetricCardProps) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-brand';

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold data-tabular">{value}</p>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-md bg-muted ${toneClass}`}>
          <Icon size={20} />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold data-tabular">{value}</p>
    </div>
  );
}
