import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Project, ProjectTask } from '@/types/database';

import {
  projectStatusLabels,
  projectStatusOptions,
  projectStatusTone,
  projectTypeLabels,
  taskPriorityLabels,
  taskPriorityOptions,
  taskPriorityTone,
  taskStatusLabels,
  taskStatusOptions,
  taskStatusTone,
} from './projects-constants';
import type { CreateLocalTaskInput } from './projects-data';
import {
  createProjectTask,
  projectsWorkspaceQueryKey,
  updateProjectStatus,
  updateProjectTaskStatus,
  type ProjectWorkspaceProject,
  type ProjectWorkspaceTask,
} from './projects-queries';

type ProjectDetailsModalProps = {
  hasRealSession: boolean;
  onClose: () => void;
  onLocalProjectStatusChange: (projectId: string, status: Project['status']) => void;
  onLocalTaskCreate: (payload: CreateLocalTaskInput) => void;
  onLocalTaskStatusChange: (taskId: string, status: ProjectTask['status']) => void;
  project: ProjectWorkspaceProject;
  tasks: ProjectWorkspaceTask[];
};

function formatDate(value: string | null) {
  if (!value) return 'Sem data';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return 'Sem data';

  return parsedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ProjectDetailsModal({
  hasRealSession,
  onClose,
  onLocalProjectStatusChange,
  onLocalTaskCreate,
  onLocalTaskStatusChange,
  project,
  tasks,
}: ProjectDetailsModalProps) {
  const queryClient = useQueryClient();
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<ProjectTask['priority']>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');

  const createTaskMutation = useMutation({
    mutationFn: createProjectTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsWorkspaceQueryKey });
      toast.success('Tarefa criada com sucesso.');
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('medium');
      setTaskDueDate('');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateProjectStatusMutation = useMutation({
    mutationFn: updateProjectStatus,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsWorkspaceQueryKey });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: updateProjectTaskStatus,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsWorkspaceQueryKey });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const groupedStats = useMemo(
    () => ({
      todo: tasks.filter((task) => task.status === 'todo').length,
      doing: tasks.filter((task) => task.status === 'doing').length,
      done: tasks.filter((task) => task.status === 'done').length,
    }),
    [tasks],
  );

  function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreateLocalTaskInput = {
      projectId: project.id,
      title: taskTitle.trim(),
      description: taskDescription.trim() ? taskDescription.trim() : null,
      priority: taskPriority,
      dueDate: taskDueDate || null,
    };

    if (!payload.title) {
      toast.error('Preencha o titulo da tarefa.');
      return;
    }

    if (hasRealSession) {
      createTaskMutation.mutate(payload);
      return;
    }

    onLocalTaskCreate(payload);
    setTaskTitle('');
    setTaskDescription('');
    setTaskPriority('medium');
    setTaskDueDate('');
    toast.success('Tarefa criada localmente.');
  }

  function handleProjectStatusChange(status: Project['status']) {
    if (hasRealSession) {
      updateProjectStatusMutation.mutate({ projectId: project.id, status });
      return;
    }

    onLocalProjectStatusChange(project.id, status);
  }

  function handleTaskStatusChange(taskId: string, status: ProjectTask['status']) {
    if (hasRealSession) {
      updateTaskStatusMutation.mutate({ taskId, status });
      return;
    }

    onLocalTaskStatusChange(taskId, status);
  }

  const isSaving =
    createTaskMutation.isPending ||
    updateProjectStatusMutation.isPending ||
    updateTaskStatusMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-border bg-card shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{project.title}</h2>
              <Badge tone={projectStatusTone(project.status)}>
                {projectStatusLabels[project.status]}
              </Badge>
              <Badge tone="neutral">{projectTypeLabels[project.project_type]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{project.accountName}</p>
          </div>
          <Button
            className="h-8 w-8 px-0"
            title="Fechar"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        <div className="grid gap-0 overflow-y-auto lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-5 border-b border-border p-5 lg:border-b-0 lg:border-r">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Inicio</p>
                <p className="mt-2 text-sm font-semibold">{formatDate(project.start_date)}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Prazo</p>
                <p className="mt-2 text-sm font-semibold">{formatDate(project.due_date)}</p>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Status do projeto</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                disabled={isSaving}
                value={project.status}
                onChange={(event) =>
                  handleProjectStatusChange(event.target.value as Project['status'])
                }
              >
                {projectStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {projectStatusLabels[option.value]}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-border p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Contexto</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {project.description || 'Sem contexto registrado para este projeto.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">A fazer</p>
                <p className="mt-2 text-2xl font-bold data-tabular">{groupedStats.todo}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Em andamento
                </p>
                <p className="mt-2 text-2xl font-bold data-tabular">{groupedStats.doing}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Concluidas</p>
                <p className="mt-2 text-2xl font-bold data-tabular">{groupedStats.done}</p>
              </div>
            </div>

            <form
              className="space-y-4 rounded-md border border-border p-4"
              onSubmit={handleCreateTask}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Nova tarefa</h3>
                  <p className="text-sm text-muted-foreground">
                    Desdobre a entrega em passos claros para a operacao.
                  </p>
                </div>
                <Badge tone="brand">Projeto</Badge>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Titulo</span>
                <Input
                  disabled={isSaving}
                  required
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Observacao</span>
                <textarea
                  className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  disabled={isSaving}
                  value={taskDescription}
                  onChange={(event) => setTaskDescription(event.target.value)}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Prioridade</span>
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    disabled={isSaving}
                    value={taskPriority}
                    onChange={(event) =>
                      setTaskPriority(event.target.value as ProjectTask['priority'])
                    }
                  >
                    {taskPriorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {taskPriorityLabels[option.value]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Prazo</span>
                  <Input
                    disabled={isSaving}
                    type="date"
                    value={taskDueDate}
                    onChange={(event) => setTaskDueDate(event.target.value)}
                  />
                </label>
              </div>

              <Button disabled={isSaving} type="submit">
                {createTaskMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Adicionar tarefa
              </Button>
            </form>
          </section>

          <section className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Tarefas do projeto</h3>
                <p className="text-sm text-muted-foreground">
                  Atualize o andamento direto desta visao.
                </p>
              </div>
              {isSaving ? (
                <Badge tone="neutral">
                  <Loader2 className="mr-1 animate-spin" size={13} />
                  Salvando
                </Badge>
              ) : null}
            </div>

            {tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <article key={task.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{task.title}</p>
                          <Badge tone={taskStatusTone(task.status)}>
                            {taskStatusLabels[task.status]}
                          </Badge>
                          <Badge tone={taskPriorityTone(task.priority)}>
                            {taskPriorityLabels[task.priority]}
                          </Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {task.description || 'Sem observacao adicional.'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Prazo: {formatDate(task.due_date)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          className="h-10 min-w-40 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          disabled={isSaving}
                          value={task.status}
                          onChange={(event) =>
                            handleTaskStatusChange(
                              task.id,
                              event.target.value as ProjectTask['status'],
                            )
                          }
                        >
                          {taskStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {taskStatusLabels[option.value]}
                            </option>
                          ))}
                        </select>
                        <Button
                          className="hidden sm:inline-flex"
                          disabled
                          type="button"
                          variant="secondary"
                        >
                          <Save size={16} />
                          Sync
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
                Nenhuma tarefa criada para este projeto ainda.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
