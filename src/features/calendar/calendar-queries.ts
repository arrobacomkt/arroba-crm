import { supabase } from '@/integrations/supabase/client';
import type { BillingCycle, Project, ProjectTask } from '@/types/database';

import {
  initialBillingCycles,
  initialCommercialLeads,
} from '@/features/opportunities/commercial-data';
import { fetchCommercialData } from '@/features/opportunities/commercial-queries';
import { loadLocalProjectWorkspace } from '@/features/projects/projects-data';
import { fetchProjectsWorkspace } from '@/features/projects/projects-queries';
import { formatBrl } from '@/lib/formatters/brl';

export type CalendarEvent = {
  accountName: string;
  dateKey: string;
  description: string;
  id: string;
  kind: 'billing' | 'follow_up' | 'project_due' | 'project_start' | 'task';
  sortAt: string;
  timeLabel: null | string;
  title: string;
  tone: 'brand' | 'danger' | 'neutral' | 'success' | 'warning';
};

export type CalendarWorkspace = {
  events: CalendarEvent[];
};

export const calendarWorkspaceQueryKey = ['calendar-workspace'] as const;

function parseCalendarDate(value: string) {
  if (value.includes('T')) {
    return new Date(value);
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

function toDateKey(value: string) {
  const date = parseCalendarDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeLabel(value: string) {
  if (!value.includes('T')) return null;

  return parseCalendarDate(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildProjectEvents(project: Project, accountName: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  if (project.start_date) {
    events.push({
      id: `project-start-${project.id}`,
      kind: 'project_start',
      title: project.title,
      description: 'Inicio do projeto',
      accountName,
      dateKey: toDateKey(project.start_date),
      sortAt: `${toDateKey(project.start_date)}T08:00:00`,
      timeLabel: null,
      tone: 'brand',
    });
  }

  if (project.due_date) {
    events.push({
      id: `project-due-${project.id}`,
      kind: 'project_due',
      title: project.title,
      description: 'Prazo do projeto',
      accountName,
      dateKey: toDateKey(project.due_date),
      sortAt: `${toDateKey(project.due_date)}T18:00:00`,
      timeLabel: null,
      tone: project.status === 'completed' ? 'success' : 'warning',
    });
  }

  return events;
}

function buildTaskEvent(
  task: Pick<ProjectTask, 'due_date' | 'id' | 'priority' | 'status' | 'title'>,
  accountName: string,
  projectTitle: string,
): CalendarEvent[] {
  if (!task.due_date) return [];

  return [
    {
      id: `task-${task.id}`,
      kind: 'task',
      title: task.title,
      description: `Tarefa de ${projectTitle}`,
      accountName,
      dateKey: toDateKey(task.due_date),
      sortAt: `${toDateKey(task.due_date)}T10:00:00`,
      timeLabel: null,
      tone: task.status === 'done' ? 'success' : task.priority === 'high' ? 'danger' : 'neutral',
    },
  ];
}

function buildBillingEvent(cycle: BillingCycle, accountName: string): CalendarEvent[] {
  const tone =
    cycle.status === 'late'
      ? 'danger'
      : cycle.status === 'paid'
        ? 'success'
        : cycle.status === 'exempt'
          ? 'neutral'
          : 'warning';

  const statusLabel =
    cycle.status === 'late'
      ? 'Fatura atrasada'
      : cycle.status === 'paid'
        ? 'Fatura paga'
        : cycle.status === 'exempt'
          ? 'Fatura isenta'
          : 'Vencimento da fatura';

  return [
    {
      id: `billing-${cycle.id}`,
      kind: 'billing',
      title: accountName,
      description: `${statusLabel} • ${formatBrl(cycle.amount)}`,
      accountName,
      dateKey: toDateKey(cycle.due_date),
      sortAt: `${toDateKey(cycle.due_date)}T09:00:00`,
      timeLabel: null,
      tone,
    },
  ];
}

function buildFollowUpEvent(lead: (typeof initialCommercialLeads)[number]): CalendarEvent[] {
  if (!lead.opportunity.next_follow_up_at) return [];

  return [
    {
      id: `follow-up-${lead.opportunity.id}`,
      kind: 'follow_up',
      title: lead.account.display_name,
      description: lead.opportunity.title,
      accountName: lead.account.display_name,
      dateKey: toDateKey(lead.opportunity.next_follow_up_at),
      sortAt: lead.opportunity.next_follow_up_at,
      timeLabel: toTimeLabel(lead.opportunity.next_follow_up_at),
      tone: 'brand',
    },
  ];
}

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((first, second) => first.sortAt.localeCompare(second.sortAt));
}

export function buildLocalCalendarWorkspace(): CalendarWorkspace {
  const localWorkspace = loadLocalProjectWorkspace();
  const projectById = new Map(localWorkspace.projects.map((project) => [project.id, project]));
  const accountById = new Map([
    ...initialCommercialLeads.map((lead) => [lead.account.id, lead.account.display_name] as const),
    ...localWorkspace.accounts.map((account) => [account.id, account.display_name] as const),
  ]);

  const events = [
    ...initialCommercialLeads.flatMap(buildFollowUpEvent),
    ...initialBillingCycles.flatMap((cycle) =>
      buildBillingEvent(cycle, accountById.get(cycle.account_id) ?? 'Cliente sem nome'),
    ),
    ...localWorkspace.projects.flatMap((project) =>
      buildProjectEvents(project, accountById.get(project.account_id) ?? 'Cliente sem nome'),
    ),
    ...localWorkspace.tasks.flatMap((task) => {
      const project = projectById.get(task.project_id);
      const accountName = project
        ? (accountById.get(project.account_id) ?? 'Cliente sem nome')
        : 'Cliente sem nome';

      return buildTaskEvent(task, accountName, project?.title ?? 'Projeto sem titulo');
    }),
  ];

  return { events: sortEvents(events) };
}

async function getCurrentOrganizationId() {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data, error } = await supabase.rpc('current_org_ids');
  if (error) throw error;

  const orgId = data.at(0);
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  return orgId;
}

export async function fetchCalendarWorkspace(): Promise<CalendarWorkspace> {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const orgId = await getCurrentOrganizationId();
  const [commercialData, projectWorkspace, billingResult] = await Promise.all([
    fetchCommercialData(),
    fetchProjectsWorkspace(),
    supabase
      .from('billing_cycles')
      .select('*')
      .eq('organization_id', orgId)
      .order('due_date', { ascending: true }),
  ]);

  if (billingResult.error) throw billingResult.error;

  const projectById = new Map(projectWorkspace.projects.map((project) => [project.id, project]));
  const accountById = new Map<string, string>();

  for (const lead of commercialData.leads) {
    accountById.set(lead.account.id, lead.account.display_name);
  }

  for (const account of projectWorkspace.accounts) {
    accountById.set(account.id, account.display_name);
  }

  const events = [
    ...commercialData.leads.flatMap((lead) =>
      buildFollowUpEvent(lead as (typeof initialCommercialLeads)[number]),
    ),
    ...(billingResult.data ?? []).flatMap((cycle) =>
      buildBillingEvent(cycle, accountById.get(cycle.account_id) ?? 'Cliente sem nome'),
    ),
    ...projectWorkspace.projects.flatMap((project) =>
      buildProjectEvents(project, accountById.get(project.account_id) ?? 'Cliente sem nome'),
    ),
    ...projectWorkspace.tasks.flatMap((task) => {
      const project = projectById.get(task.project_id);
      return buildTaskEvent(
        task,
        task.accountName,
        project?.title ?? task.projectTitle ?? 'Projeto sem titulo',
      );
    }),
  ];

  return { events: sortEvents(events) };
}
