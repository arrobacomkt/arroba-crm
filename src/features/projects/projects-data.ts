import { initialCommercialLeads } from '@/features/opportunities/commercial-data';
import type { Account, Project, ProjectTask } from '@/types/database';

export type ProjectAccountOption = Pick<Account, 'id' | 'display_name'>;

export type LocalProjectWorkspace = {
  accounts: ProjectAccountOption[];
  projects: Project[];
  tasks: ProjectTask[];
};

const LOCAL_STORAGE_KEY = 'arrobaco.localProjectsWorkspace';
const organizationId = 'org-arroba-local';
const ownerId = 'local-richards';

function isoNow() {
  return new Date().toISOString();
}

function buildSeedAccounts(): ProjectAccountOption[] {
  return initialCommercialLeads
    .filter((lead) => lead.account.lifecycle_status === 'client')
    .map((lead) => ({
      id: lead.account.id,
      display_name: lead.account.display_name,
    }));
}

function buildInitialLocalWorkspace(): LocalProjectWorkspace {
  const createdAt = isoNow();
  const accounts = buildSeedAccounts();

  const projects: Project[] = [
    {
      id: 'project-kianda-onboarding',
      organization_id: organizationId,
      account_id: 'account-kianda',
      title: 'Onboarding de conteudo Kianda',
      description: 'Estrutura inicial da rotina de conteudo, calendario e ajustes de captacao.',
      project_type: 'onboarding',
      status: 'active',
      owner_id: ownerId,
      start_date: '2026-07-08',
      due_date: '2026-07-22',
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const tasks: ProjectTask[] = [
    {
      id: 'task-kianda-briefing',
      organization_id: organizationId,
      project_id: 'project-kianda-onboarding',
      title: 'Fechar briefing de captacao',
      description: null,
      status: 'done',
      priority: 'high',
      assignee_id: ownerId,
      due_date: '2026-07-09',
      sort_order: 1,
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: 'task-kianda-calendario',
      organization_id: organizationId,
      project_id: 'project-kianda-onboarding',
      title: 'Montar calendario da primeira quinzena',
      description: null,
      status: 'doing',
      priority: 'high',
      assignee_id: ownerId,
      due_date: '2026-07-11',
      sort_order: 2,
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: 'task-kianda-acessos',
      organization_id: organizationId,
      project_id: 'project-kianda-onboarding',
      title: 'Conferir acessos e responsaveis',
      description: null,
      status: 'todo',
      priority: 'medium',
      assignee_id: null,
      due_date: '2026-07-12',
      sort_order: 3,
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  return { accounts, projects, tasks };
}

function persist(workspace: LocalProjectWorkspace) {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(workspace));
}

export function loadLocalProjectWorkspace(): LocalProjectWorkspace {
  if (typeof window === 'undefined') {
    return buildInitialLocalWorkspace();
  }

  const seedAccounts = buildSeedAccounts();
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!raw) {
    const initialWorkspace = buildInitialLocalWorkspace();
    persist(initialWorkspace);
    return initialWorkspace;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalProjectWorkspace>;
    const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
    const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const mergedAccounts = [...seedAccounts];

    for (const account of accounts) {
      if (!mergedAccounts.some((item) => item.id === account.id)) {
        mergedAccounts.push(account);
      }
    }

    const workspace = { accounts: mergedAccounts, projects, tasks };
    persist(workspace);
    return workspace;
  } catch {
    const initialWorkspace = buildInitialLocalWorkspace();
    persist(initialWorkspace);
    return initialWorkspace;
  }
}

export type CreateLocalProjectInput = {
  accountId: string;
  title: string;
  description: string | null;
  projectType: Project['project_type'];
  status: Project['status'];
  startDate: string | null;
  dueDate: string | null;
};

export function createLocalProject(
  workspace: LocalProjectWorkspace,
  values: CreateLocalProjectInput,
): LocalProjectWorkspace {
  const timestamp = isoNow();
  const nextProject: Project = {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    account_id: values.accountId,
    title: values.title,
    description: values.description,
    project_type: values.projectType,
    status: values.status,
    owner_id: ownerId,
    start_date: values.startDate,
    due_date: values.dueDate,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const nextWorkspace = {
    ...workspace,
    projects: [nextProject, ...workspace.projects],
  };
  persist(nextWorkspace);
  return nextWorkspace;
}

export type CreateLocalTaskInput = {
  projectId: string;
  title: string;
  description: string | null;
  priority: ProjectTask['priority'];
  dueDate: string | null;
};

export function createLocalTask(
  workspace: LocalProjectWorkspace,
  values: CreateLocalTaskInput,
): LocalProjectWorkspace {
  const timestamp = isoNow();
  const nextSortOrder =
    workspace.tasks
      .filter((task) => task.project_id === values.projectId)
      .reduce((max, task) => Math.max(max, task.sort_order), 0) + 1;

  const nextTask: ProjectTask = {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    project_id: values.projectId,
    title: values.title,
    description: values.description,
    status: 'todo',
    priority: values.priority,
    assignee_id: null,
    due_date: values.dueDate,
    sort_order: nextSortOrder,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const nextWorkspace = {
    ...workspace,
    tasks: [...workspace.tasks, nextTask],
    projects: workspace.projects.map((project) =>
      project.id === values.projectId ? { ...project, updated_at: timestamp } : project,
    ),
  };
  persist(nextWorkspace);
  return nextWorkspace;
}

export function updateLocalProjectStatus(
  workspace: LocalProjectWorkspace,
  projectId: string,
  status: Project['status'],
): LocalProjectWorkspace {
  const timestamp = isoNow();
  const nextWorkspace = {
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id === projectId ? { ...project, status, updated_at: timestamp } : project,
    ),
  };
  persist(nextWorkspace);
  return nextWorkspace;
}

export function updateLocalTaskStatus(
  workspace: LocalProjectWorkspace,
  taskId: string,
  status: ProjectTask['status'],
): LocalProjectWorkspace {
  const timestamp = isoNow();
  let affectedProjectId: string | null = null;

  const tasks = workspace.tasks.map((task) => {
    if (task.id !== taskId) return task;
    affectedProjectId = task.project_id;
    return { ...task, status, updated_at: timestamp };
  });

  const projects =
    affectedProjectId === null
      ? workspace.projects
      : workspace.projects.map((project) =>
          project.id === affectedProjectId ? { ...project, updated_at: timestamp } : project,
        );

  const nextWorkspace = {
    ...workspace,
    tasks,
    projects,
  };
  persist(nextWorkspace);
  return nextWorkspace;
}
