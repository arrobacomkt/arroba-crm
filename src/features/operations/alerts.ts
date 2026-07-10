import type { BillingCycle, ClientService } from '@/types/database';

import type { CommercialLead } from '@/features/opportunities/commercial-data';
import type {
  ProjectWorkspaceProject,
  ProjectWorkspaceTask,
} from '@/features/projects/projects-queries';

export type FinancialSnapshot = {
  lateInvoices: number;
  mrr: number;
  pendingInvoices: number;
};

export type AutomationAlert = {
  dueLabel: string;
  kind: 'billing' | 'follow_up' | 'project' | 'task';
  target: string;
  title: string;
  tone: 'brand' | 'danger' | 'neutral' | 'warning';
};

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isSameLocalDate(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function daysFromToday(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;

  const today = startOfToday().getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

export function relativeDueLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';

  const distance = daysFromToday(value);
  if (distance < 0) return `Atrasado ha ${Math.abs(distance)} dia(s)`;
  if (distance === 0) return 'Hoje';
  if (distance === 1) return 'Amanha';
  return `Em ${distance} dia(s)`;
}

export function sortAlerts(items: AutomationAlert[]) {
  const toneWeight = { danger: 0, warning: 1, brand: 2, neutral: 3 } as const;

  return [...items].sort((first, second) => {
    if (toneWeight[first.tone] !== toneWeight[second.tone]) {
      return toneWeight[first.tone] - toneWeight[second.tone];
    }

    return first.dueLabel.localeCompare(second.dueLabel);
  });
}

export function buildOperationalAlerts(input: {
  financials: FinancialSnapshot | null;
  leads: CommercialLead[];
  projects: ProjectWorkspaceProject[];
  tasks: ProjectWorkspaceTask[];
}) {
  const { financials, leads, projects, tasks } = input;
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
  const openTasks = tasks.filter((task) => task.status !== 'done');
  const overdueTasks = openTasks.filter(
    (task) => task.due_date && daysFromToday(task.due_date) < 0,
  );
  const todayTasks = openTasks.filter(
    (task) => task.due_date && daysFromToday(task.due_date) === 0,
  );
  const upcomingTasks = openTasks
    .filter(
      (task) =>
        task.due_date && daysFromToday(task.due_date) > 0 && daysFromToday(task.due_date) <= 3,
    )
    .slice(0, 4);
  const overdueProjects = projects.filter(
    (project) =>
      project.due_date &&
      !['completed', 'archived'].includes(project.status) &&
      daysFromToday(project.due_date) < 0,
  );
  const upcomingProjects = projects
    .filter(
      (project) =>
        project.due_date &&
        !['completed', 'archived'].includes(project.status) &&
        daysFromToday(project.due_date) >= 0 &&
        daysFromToday(project.due_date) <= 7,
    )
    .slice(0, 4);

  return {
    criticalAlerts: sortAlerts([
      ...overdueFollowUps.map(({ lead }): AutomationAlert => ({
        kind: 'follow_up',
        title: lead.opportunity.title,
        target: lead.account.display_name,
        dueLabel: relativeDueLabel(lead.opportunity.next_follow_up_at ?? ''),
        tone: 'danger',
      })),
      ...overdueTasks.map((task): AutomationAlert => ({
        kind: 'task',
        title: task.title,
        target: `${task.accountName} • ${task.projectTitle}`,
        dueLabel: relativeDueLabel(task.due_date ?? ''),
        tone: task.priority === 'high' ? 'danger' : 'warning',
      })),
      ...overdueProjects.map((project): AutomationAlert => ({
        kind: 'project',
        title: project.title,
        target: project.accountName,
        dueLabel: relativeDueLabel(project.due_date ?? ''),
        tone: 'warning',
      })),
      ...(financials?.lateInvoices
        ? [
            {
              kind: 'billing' as const,
              title: 'Faturas atrasadas',
              target: 'Financeiro',
              dueLabel: `${financials.lateInvoices} pendencia(s)`,
              tone: 'danger' as const,
            },
          ]
        : []),
    ]).slice(0, 6),
    dueSoonAlerts: sortAlerts([
      ...todayFollowUps.map(({ lead }): AutomationAlert => ({
        kind: 'follow_up',
        title: lead.opportunity.title,
        target: lead.account.display_name,
        dueLabel: relativeDueLabel(lead.opportunity.next_follow_up_at ?? ''),
        tone: 'brand',
      })),
      ...todayTasks.map((task): AutomationAlert => ({
        kind: 'task',
        title: task.title,
        target: `${task.accountName} • ${task.projectTitle}`,
        dueLabel: relativeDueLabel(task.due_date ?? ''),
        tone: task.priority === 'high' ? 'warning' : 'brand',
      })),
      ...upcomingTasks.map((task): AutomationAlert => ({
        kind: 'task',
        title: task.title,
        target: `${task.accountName} • ${task.projectTitle}`,
        dueLabel: relativeDueLabel(task.due_date ?? ''),
        tone: 'neutral',
      })),
      ...upcomingProjects.map((project): AutomationAlert => ({
        kind: 'project',
        title: project.title,
        target: project.accountName,
        dueLabel: relativeDueLabel(project.due_date ?? ''),
        tone: 'neutral',
      })),
    ]).slice(0, 6),
    counts: {
      overdueFollowUps: overdueFollowUps.length,
      overdueTasks: overdueTasks.length,
      overdueProjects: overdueProjects.length,
      todayFollowUps: todayFollowUps.length,
      todayTasks: todayTasks.length,
    },
  };
}

export function deriveLocalFinancials(
  services: ClientService[],
  billingCycles: BillingCycle[],
): FinancialSnapshot {
  const mrr = services
    .filter((service) => service.status === 'active' && service.recurrence === 'monthly')
    .reduce((acc, curr) => acc + Number(curr.contracted_price), 0);

  const pendingInvoices = billingCycles.filter((cycle) => cycle.status === 'pending').length;
  const lateInvoices = billingCycles.filter((cycle) => cycle.status === 'late').length;

  return { mrr, pendingInvoices, lateInvoices };
}

export function alertKindLabel(kind: AutomationAlert['kind']) {
  switch (kind) {
    case 'follow_up':
      return 'Follow-up';
    case 'task':
      return 'Tarefa';
    case 'project':
      return 'Projeto';
    case 'billing':
      return 'Financeiro';
  }
}

export function routeForAlertKind(kind: AutomationAlert['kind']) {
  switch (kind) {
    case 'follow_up':
      return '/app/comercial/leads';
    case 'task':
      return '/app/tarefas/lista';
    case 'project':
      return '/app/projetos/ativos';
    case 'billing':
      return '/app/calendario';
  }
}

export function routeForAlert(alert: AutomationAlert) {
  const urgency =
    alert.tone === 'danger'
      ? 'overdue'
      : alert.tone === 'brand' || alert.tone === 'warning'
        ? 'soon'
        : 'upcoming';

  switch (alert.kind) {
    case 'follow_up':
      return `/app/comercial/follow-ups?followUp=${urgency === 'overdue' ? 'overdue' : urgency === 'soon' ? 'today' : 'upcoming'}`;
    case 'task':
      return `/app/tarefas/lista?timing=${urgency}`;
    case 'project':
      return `/app/projetos/ativos?timing=${urgency}`;
    case 'billing':
      return `/app/calendario?kind=billing&focus=${urgency === 'overdue' ? 'critical' : 'all'}`;
  }
}
