import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban,
  Loader2,
  PauseCircle,
  Plus,
  Rocket,
  Search,
  SquareCheckBig,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { daysFromToday } from '@/features/operations/alerts';

import { projectStatusLabels, projectStatusTone, projectTypeLabels } from './projects-constants';
import {
  createLocalProject,
  createLocalTask,
  loadLocalProjectWorkspace,
  updateLocalProjectStatus,
  updateLocalTaskStatus,
} from './projects-data';
import { ProjectAddModal } from './project-add-modal';
import { ProjectDetailsModal } from './project-details-modal';
import {
  fetchProjectsWorkspace,
  projectsWorkspaceQueryKey,
  type ProjectWorkspaceProject,
  type ProjectWorkspaceTask,
} from './projects-queries';

function formatDate(value: string | null) {
  if (!value) return 'Sem prazo';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return 'Sem prazo';

  return parsedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ProjectsPage() {
  const { isSupabaseConfigured, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';

  const workspaceQuery = useQuery({
    queryKey: projectsWorkspaceQueryKey,
    queryFn: fetchProjectsWorkspace,
    enabled: hasRealSession,
  });

  const [localWorkspace, setLocalWorkspace] = useState(() => loadLocalProjectWorkspace());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectWorkspaceProject['status']>('all');

  const localWorkspaceView = useMemo(() => {
    const accountById = new Map(
      localWorkspace.accounts.map((account) => [account.id, account.display_name]),
    );
    const taskSummaryByProjectId = new Map<string, { done: number; total: number }>();

    for (const task of localWorkspace.tasks) {
      const summary = taskSummaryByProjectId.get(task.project_id) ?? { done: 0, total: 0 };
      summary.total += 1;
      if (task.status === 'done') {
        summary.done += 1;
      }
      taskSummaryByProjectId.set(task.project_id, summary);
    }

    const projectById = new Map(localWorkspace.projects.map((project) => [project.id, project]));

    return {
      accounts: localWorkspace.accounts,
      projects: localWorkspace.projects.map((project) => {
        const taskSummary = taskSummaryByProjectId.get(project.id) ?? { done: 0, total: 0 };

        return {
          ...project,
          accountName: accountById.get(project.account_id) ?? 'Cliente sem nome',
          completedTaskCount: taskSummary.done,
          taskCount: taskSummary.total,
        };
      }),
      tasks: localWorkspace.tasks.map((task) => {
        const project = projectById.get(task.project_id);

        return {
          ...task,
          accountName: project
            ? (accountById.get(project.account_id) ?? 'Cliente sem nome')
            : 'Cliente sem nome',
          projectStatus: project?.status ?? 'planned',
          projectTitle: project?.title ?? 'Projeto sem titulo',
        };
      }),
    };
  }, [localWorkspace]);

  const workspace = hasRealSession
    ? (workspaceQuery.data ?? { accounts: [], projects: [], tasks: [] })
    : localWorkspaceView;
  const timingFilter = searchParams.get('timing');
  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return workspace.projects.filter((project) => {
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;
      if (timingFilter) {
        if (!project.due_date || ['completed', 'archived'].includes(project.status)) return false;
        const distance = daysFromToday(project.due_date);

        if (timingFilter === 'overdue' && distance >= 0) return false;
        if (timingFilter === 'soon' && distance > 0) return false;
        if (timingFilter === 'upcoming' && !(distance > 0 && distance <= 7)) return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [project.title, project.accountName, project.description ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [search, statusFilter, timingFilter, workspace.projects]);

  const selectedProject = useMemo(
    () => filteredProjects.find((project) => project.id === selectedProjectId) ?? null,
    [filteredProjects, selectedProjectId],
  );

  const selectedProjectTasks = useMemo(
    () =>
      workspace.tasks.filter(
        (task): task is ProjectWorkspaceTask => task.project_id === selectedProjectId,
      ),
    [selectedProjectId, workspace.tasks],
  );

  const stats = useMemo(
    () => ({
      active: workspace.projects.filter((project) => project.status === 'active').length,
      blocked: workspace.projects.filter((project) => project.status === 'blocked').length,
      completedTasks: workspace.tasks.filter((task) => task.status === 'done').length,
      overdue: workspace.projects.filter(
        (project) =>
          project.due_date &&
          !['completed', 'archived'].includes(project.status) &&
          daysFromToday(project.due_date) < 0,
      ).length,
    }),
    [workspace.projects, workspace.tasks],
  );
  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== 'all' || Boolean(timingFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize onboarding, entregas avulsas e operacao mensal dos clientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {timingFilter ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('timing');
                setSearchParams(next);
              }}
            >
              Limpar filtro
            </Button>
          ) : null}
          {workspaceQuery.isFetching ? (
            <Badge tone="neutral">
              <Loader2 className="mr-1 animate-spin" size={13} />
              Atualizando
            </Badge>
          ) : null}
          <Badge tone={hasRealSession ? 'success' : 'neutral'}>
            {hasRealSession ? 'Supabase' : 'Local'}
          </Badge>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            Novo projeto
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Projetos ativos</p>
              <p className="mt-2 text-2xl font-bold data-tabular">{stats.active}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
              <Rocket size={20} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Bloqueados</p>
              <p className="mt-2 text-2xl font-bold data-tabular">{stats.blocked}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
              <PauseCircle size={20} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Tarefas concluidas</p>
              <p className="mt-2 text-2xl font-bold data-tabular">{stats.completedTasks}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
              <SquareCheckBig size={20} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Projetos em atraso</p>
              <p className="mt-2 text-2xl font-bold data-tabular">{stats.overdue}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
              <PauseCircle size={20} />
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">Carteira de projetos</h2>
              <p className="text-sm text-muted-foreground">
                Filtre por contexto, status e prazo para encontrar o que importa mais rapido.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <label className="relative block">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  className="pl-9"
                  placeholder="Buscar por cliente, projeto ou contexto"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="block">
                <select
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'all' | ProjectWorkspaceProject['status'])
                  }
                >
                  <option value="all">Todos os status</option>
                  <option value="planned">Planejados</option>
                  <option value="active">Ativos</option>
                  <option value="blocked">Bloqueados</option>
                  <option value="completed">Concluidos</option>
                  <option value="archived">Arquivados</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {filteredProjects.length} projeto(s) exibido(s)
              </span>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                    const next = new URLSearchParams(searchParams);
                    next.delete('timing');
                    setSearchParams(next);
                  }}
                >
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {workspaceQuery.isError ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              {workspaceQuery.error.message}
            </p>
          ) : filteredProjects.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => setSelectedProjectId(project.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FolderKanban size={22} />}
              title="Nenhum projeto criado ainda"
              description={
                timingFilter
                  ? 'Nenhum projeto combina com o filtro atual.'
                  : 'Comece pelos onboardings ativos ou pelas demandas avulsas dos clientes.'
              }
            />
          )}
        </CardContent>
      </Card>

      {showAddModal ? (
        <ProjectAddModal
          accounts={workspace.accounts}
          hasRealSession={hasRealSession}
          onClose={() => setShowAddModal(false)}
          onSuccessLocal={(payload) => {
            setLocalWorkspace((current) => createLocalProject(current, payload));
          }}
        />
      ) : null}

      {selectedProject ? (
        <ProjectDetailsModal
          hasRealSession={hasRealSession}
          project={selectedProject}
          tasks={selectedProjectTasks}
          onClose={() => setSelectedProjectId(null)}
          onLocalProjectStatusChange={(projectId, status) => {
            setLocalWorkspace((current) => updateLocalProjectStatus(current, projectId, status));
          }}
          onLocalTaskCreate={(payload) => {
            setLocalWorkspace((current) => createLocalTask(current, payload));
          }}
          onLocalTaskStatusChange={(taskId, status) => {
            setLocalWorkspace((current) => updateLocalTaskStatus(current, taskId, status));
          }}
        />
      ) : null}
    </div>
  );
}

type ProjectCardProps = {
  onOpen: () => void;
  project: ProjectWorkspaceProject;
};

function ProjectCard({ onOpen, project }: ProjectCardProps) {
  const completionLabel =
    project.taskCount > 0
      ? `${project.completedTaskCount}/${project.taskCount} tarefas`
      : 'Sem tarefas';
  const completionPercentage =
    project.taskCount > 0 ? Math.round((project.completedTaskCount / project.taskCount) * 100) : 0;
  const dueDistance = project.due_date ? daysFromToday(project.due_date) : null;
  const dueTone =
    dueDistance === null
      ? 'neutral'
      : dueDistance < 0
        ? 'danger'
        : dueDistance === 0
          ? 'warning'
          : 'neutral';
  const dueLabel =
    dueDistance === null
      ? 'Sem prazo'
      : dueDistance < 0
        ? `${Math.abs(dueDistance)} dia(s) de atraso`
        : dueDistance === 0
          ? 'Entrega hoje'
          : `Entrega em ${dueDistance} dia(s)`;

  return (
    <article
      className="cursor-pointer rounded-md border border-border p-4 transition-colors hover:border-brand/50 hover:bg-muted/30"
      onClick={onOpen}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-semibold">{project.title}</h3>
          <p className="text-sm text-muted-foreground">{project.accountName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={projectStatusTone(project.status)}>
            {projectStatusLabels[project.status]}
          </Badge>
          <Badge tone="neutral">{projectTypeLabels[project.project_type]}</Badge>
          <Badge tone={dueTone}>{dueLabel}</Badge>
        </div>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {project.description || 'Sem contexto adicional registrado.'}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs uppercase text-muted-foreground">Prazo</p>
          <p className="mt-2 text-sm font-semibold">{formatDate(project.due_date)}</p>
        </div>
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs uppercase text-muted-foreground">Status</p>
          <p className="mt-2 text-sm font-semibold">{projectStatusLabels[project.status]}</p>
        </div>
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs uppercase text-muted-foreground">Entrega</p>
          <p className="mt-2 text-sm font-semibold">{completionLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{completionPercentage}% concluido</p>
        </div>
      </div>
    </article>
  );
}
