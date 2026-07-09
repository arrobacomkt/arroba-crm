import { supabase } from '@/integrations/supabase/client';
import type { Project, ProjectTask } from '@/types/database';

import type { ProjectAccountOption } from './projects-data';

export type ProjectWorkspaceProject = Project & {
  accountName: string;
  completedTaskCount: number;
  taskCount: number;
};

export type ProjectWorkspaceTask = ProjectTask & {
  accountName: string;
  projectStatus: Project['status'];
  projectTitle: string;
};

export type ProjectWorkspace = {
  accounts: ProjectAccountOption[];
  projects: ProjectWorkspaceProject[];
  tasks: ProjectWorkspaceTask[];
};

export const projectsWorkspaceQueryKey = ['projects-workspace'] as const;

async function getCurrentOrganizationId() {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data, error } = await supabase.rpc('current_org_ids');
  if (error) throw error;

  const orgId = data.at(0);
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  return orgId;
}

async function getCurrentUserId() {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sessao invalida.');
  return data.user.id;
}

export async function fetchProjectsWorkspace(): Promise<ProjectWorkspace> {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const orgId = await getCurrentOrganizationId();
  const [projectsResult, tasksResult, accountsResult] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('project_tasks')
      .select('*')
      .eq('organization_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('accounts')
      .select('id, display_name')
      .eq('organization_id', orgId)
      .eq('lifecycle_status', 'client')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('display_name', { ascending: true }),
  ]);

  if (projectsResult.error) throw projectsResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (accountsResult.error) throw accountsResult.error;

  const projects = projectsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const accounts = accountsResult.data ?? [];

  const accountById = new Map(accounts.map((account) => [account.id, account.display_name]));
  const taskSummaryByProjectId = new Map<string, { done: number; total: number }>();

  for (const task of tasks) {
    const summary = taskSummaryByProjectId.get(task.project_id) ?? { done: 0, total: 0 };
    summary.total += 1;
    if (task.status === 'done') {
      summary.done += 1;
    }
    taskSummaryByProjectId.set(task.project_id, summary);
  }

  const projectById = new Map(projects.map((project) => [project.id, project]));

  return {
    accounts,
    projects: projects.map((project) => {
      const taskSummary = taskSummaryByProjectId.get(project.id) ?? { done: 0, total: 0 };

      return {
        ...project,
        accountName: accountById.get(project.account_id) ?? 'Cliente sem nome',
        completedTaskCount: taskSummary.done,
        taskCount: taskSummary.total,
      };
    }),
    tasks: tasks.map((task) => {
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
}

export type CreateProjectInput = {
  accountId: string;
  description: string | null;
  dueDate: string | null;
  projectType: Project['project_type'];
  startDate: string | null;
  status: Project['status'];
  title: string;
};

export async function createProject(values: CreateProjectInput) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const [organizationId, ownerId] = await Promise.all([
    getCurrentOrganizationId(),
    getCurrentUserId(),
  ]);

  const { data, error } = await supabase
    .from('projects')
    .insert({
      organization_id: organizationId,
      account_id: values.accountId,
      title: values.title,
      description: values.description,
      project_type: values.projectType,
      status: values.status,
      owner_id: ownerId,
      start_date: values.startDate,
      due_date: values.dueDate,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export type CreateProjectTaskInput = {
  description: string | null;
  dueDate: string | null;
  priority: ProjectTask['priority'];
  projectId: string;
  title: string;
};

export async function createProjectTask(values: CreateProjectTaskInput) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const organizationId = await getCurrentOrganizationId();
  const { data: lastTasks, error: lastTaskError } = await supabase
    .from('project_tasks')
    .select('sort_order')
    .eq('project_id', values.projectId)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (lastTaskError) throw lastTaskError;

  const nextSortOrder = (lastTasks?.[0]?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('project_tasks')
    .insert({
      organization_id: organizationId,
      project_id: values.projectId,
      title: values.title,
      description: values.description,
      priority: values.priority,
      due_date: values.dueDate,
      status: 'todo',
      sort_order: nextSortOrder,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectStatus(values: {
  projectId: string;
  status: Project['status'];
}) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { error } = await supabase
    .from('projects')
    .update({ status: values.status })
    .eq('id', values.projectId);

  if (error) throw error;
}

export async function updateProjectTaskStatus(values: {
  status: ProjectTask['status'];
  taskId: string;
}) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { error } = await supabase
    .from('project_tasks')
    .update({ status: values.status })
    .eq('id', values.taskId);

  if (error) throw error;
}
