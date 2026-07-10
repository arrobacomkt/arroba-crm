import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Loader2, ListTodo, PlayCircle } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { taskTabs } from '@/app/module-tabs-config';
import { ModulePageLayout } from '@/components/layout/module-page-layout';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';
import { daysFromToday } from '@/features/operations/alerts';
import type { ProjectTask } from '@/types/database';

import {
  taskPriorityLabels,
  taskPriorityTone,
  taskStatusLabels,
  taskStatusOptions,
  taskStatusTone,
} from './projects-constants';
import { loadLocalProjectWorkspace, updateLocalTaskStatus } from './projects-data';
import {
  fetchProjectsWorkspace,
  projectsWorkspaceQueryKey,
  updateProjectTaskStatus,
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

export function TasksPage() {
  const location = useLocation();
  const { isSupabaseConfigured, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';
  const queryClient = useQueryClient();
  const currentTab = location.pathname.split('/').pop() ?? 'lista';

  const workspaceQuery = useQuery({
    queryKey: projectsWorkspaceQueryKey,
    queryFn: fetchProjectsWorkspace,
    enabled: hasRealSession,
  });

  const [localWorkspace, setLocalWorkspace] = useState(() => loadLocalProjectWorkspace());
  const tasks = useMemo(
    () =>
      hasRealSession
        ? (workspaceQuery.data?.tasks ?? [])
        : localWorkspace.tasks.map((task) => {
            const project = localWorkspace.projects.find((item) => item.id === task.project_id);
            const account = localWorkspace.accounts.find((item) => item.id === project?.account_id);

            return {
              ...task,
              accountName: account?.display_name ?? 'Cliente sem nome',
              projectStatus: project?.status ?? 'planned',
              projectTitle: project?.title ?? 'Projeto sem titulo',
            };
          }),
    [hasRealSession, localWorkspace, workspaceQuery.data?.tasks],
  );

  const updateTaskStatusMutation = useMutation({
    mutationFn: updateProjectTaskStatus,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsWorkspaceQueryKey });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const timingFilter = searchParams.get('timing');
  const filteredTasks = useMemo(() => {
    const tabScopedTasks = tasks.filter((task) => {
      if (currentTab === 'minhas') {
        return task.assignee_id === user?.id;
      }
      if (currentTab === 'atrasadas') {
        return task.status !== 'done' && Boolean(task.due_date) && daysFromToday(task.due_date ?? '') < 0;
      }
      return true;
    });

    if (!timingFilter) return tabScopedTasks;

    return tabScopedTasks.filter((task) => {
      if (task.status === 'done' || !task.due_date) return false;
      const distance = daysFromToday(task.due_date);

      if (timingFilter === 'overdue') return distance < 0;
      if (timingFilter === 'soon') return distance <= 0;
      if (timingFilter === 'upcoming') return distance > 0 && distance <= 3;
      return true;
    });
  }, [currentTab, tasks, timingFilter, user?.id]);

  const groupedTasks = useMemo(
    () => ({
      todo: filteredTasks.filter((task) => task.status === 'todo'),
      doing: filteredTasks.filter((task) => task.status === 'doing'),
      done: filteredTasks.filter((task) => task.status === 'done'),
    }),
    [filteredTasks],
  );

  function handleTaskStatusChange(taskId: string, status: ProjectTask['status']) {
    if (hasRealSession) {
      updateTaskStatusMutation.mutate({ taskId, status });
      return;
    }

    setLocalWorkspace((current) => updateLocalTaskStatus(current, taskId, status));
  }

  return (
    <ModulePageLayout
      title="Tarefas"
      description="Visoes por lista, fluxo, calendario e prioridade, cada uma com sua propria rota."
      breadcrumbs={[
        { label: 'Tarefas', to: '/app/tarefas/lista' },
        { label: taskTabs.find((tab) => tab.to.endsWith(`/${currentTab}`))?.label ?? 'Lista' },
      ]}
      tabs={taskTabs}
      actions={
        <>
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
          {workspaceQuery.isFetching || updateTaskStatusMutation.isPending ? (
            <Badge tone="neutral">
              <Loader2 className="mr-1 animate-spin" size={13} />
              Atualizando
            </Badge>
          ) : null}
          <Badge tone={hasRealSession ? 'success' : 'neutral'}>
            {hasRealSession ? 'Supabase' : 'Local'}
          </Badge>
        </>
      }
    >

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">A fazer</p>
              <p className="mt-2 text-2xl font-bold data-tabular">{groupedTasks.todo.length}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
              <ListTodo size={20} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Em andamento</p>
              <p className="mt-2 text-2xl font-bold data-tabular">{groupedTasks.doing.length}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
              <PlayCircle size={20} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Concluidas</p>
              <p className="mt-2 text-2xl font-bold data-tabular">{groupedTasks.done.length}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-brand">
              <CheckCircle2 size={20} />
            </div>
          </CardContent>
        </Card>
      </section>

      {workspaceQuery.isError ? (
        <p className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {workspaceQuery.error.message}
        </p>
      ) : tasks.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <TaskColumn
            icon={<ListTodo size={18} />}
            items={groupedTasks.todo}
            title="A fazer"
            onStatusChange={handleTaskStatusChange}
          />
          <TaskColumn
            icon={<PlayCircle size={18} />}
            items={groupedTasks.doing}
            title="Em andamento"
            onStatusChange={handleTaskStatusChange}
          />
          <TaskColumn
            icon={<CheckCircle2 size={18} />}
            items={groupedTasks.done}
            title="Concluidas"
            onStatusChange={handleTaskStatusChange}
          />
        </section>
      ) : (
        <EmptyState
          icon={<ClipboardList size={22} />}
          title="Nenhuma tarefa registrada"
          description="Crie tarefas dentro dos projetos para acompanhar a operacao."
        />
      )}
    </ModulePageLayout>
  );
}

type TaskColumnProps = {
  icon: ReactNode;
  items: ProjectWorkspaceTask[];
  onStatusChange: (taskId: string, status: ProjectTask['status']) => void;
  title: string;
};

function TaskColumn({ icon, items, onStatusChange, title }: TaskColumnProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-muted text-brand">
              {icon}
            </div>
            <div>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{items.length} itens</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((task) => (
              <article key={task.id} className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{task.title}</p>
                  <Badge tone={taskPriorityTone(task.priority)}>
                    {taskPriorityLabels[task.priority]}
                  </Badge>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">{task.projectTitle}</p>
                <p className="text-xs text-muted-foreground">{task.accountName}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={taskStatusTone(task.status)}>{taskStatusLabels[task.status]}</Badge>
                  <Badge tone="neutral">{formatDate(task.due_date)}</Badge>
                </div>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {task.description || 'Sem observacao adicional.'}
                </p>

                <div className="mt-4">
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    value={task.status}
                    onChange={(event) =>
                      onStatusChange(task.id, event.target.value as ProjectTask['status'])
                    }
                  >
                    {taskStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {taskStatusLabels[option.value]}
                      </option>
                    ))}
                  </select>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            Sem itens nesta coluna.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
