import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  alertKindLabel,
  buildOperationalAlerts,
  daysFromToday,
  deriveLocalFinancials,
  relativeDueLabel,
  routeForAlert,
  routeForAlertKind,
} from '@/features/operations/alerts';
import type { CommercialLead } from '@/features/opportunities/commercial-data';
import type {
  ProjectWorkspaceProject,
  ProjectWorkspaceTask,
} from '@/features/projects/projects-queries';
import type { BillingCycle, ClientService } from '@/types/database';

function buildLead(overrides: Partial<CommercialLead>): CommercialLead {
  return {
    account: {
      id: 'account-1',
      display_name: 'Kianda',
      lifecycle_status: 'lead',
      status: 'active',
      city: null,
      state: null,
      address: null,
      cnpj: null,
      created_at: '2026-07-01T10:00:00.000Z',
      created_by: 'user-1',
      deleted_at: null,
      instagram_url: null,
      lead_source: null,
      lead_temperature: 'warm',
      legal_name: null,
      organization_id: 'org-1',
      owner_id: null,
      segment: 'Moda',
      strategic_notes: null,
      updated_at: '2026-07-01T10:00:00.000Z',
      website_url: null,
    },
    contact: {
      id: 'contact-1',
      account_id: 'account-1',
      created_at: '2026-07-01T10:00:00.000Z',
      email: null,
      full_name: 'Marina',
      is_primary: true,
      notes: null,
      organization_id: 'org-1',
      phone: null,
      role_title: null,
      updated_at: '2026-07-01T10:00:00.000Z',
      whatsapp: null,
    },
    opportunity: {
      id: 'opp-1',
      account_id: 'account-1',
      converted_at: null,
      created_at: '2026-07-01T10:00:00.000Z',
      estimated_value: 2500,
      expected_close_date: null,
      lost_at: null,
      lost_reason: null,
      next_follow_up_at: '2026-07-08T09:00:00.000Z',
      organization_id: 'org-1',
      owner_id: 'user-1',
      pipeline_stage_id: 'stage-1',
      primary_contact_id: 'contact-1',
      proposal_valid_until: null,
      title: 'Plano Mensal',
      updated_at: '2026-07-08T09:00:00.000Z',
      won_at: null,
    },
    pipelineStage: {
      id: 'stage-1',
      color_token: null,
      created_at: '2026-07-01T10:00:00.000Z',
      is_active: true,
      key: 'proposal',
      name: 'Proposta',
      organization_id: 'org-1',
      position: 1,
      stage_group: 'open',
    },
    services: [],
    ...overrides,
  };
}

function buildTask(overrides: Partial<ProjectWorkspaceTask>): ProjectWorkspaceTask {
  return {
    id: 'task-1',
    accountName: 'Kianda',
    assigneeName: null,
    created_at: '2026-07-01T10:00:00.000Z',
    description: null,
    due_date: '2026-07-08T12:00:00.000Z',
    organization_id: 'org-1',
    priority: 'high',
    project_id: 'project-1',
    projectStatus: 'active',
    projectTitle: 'Onboarding',
    sort_order: 0,
    status: 'todo',
    title: 'Enviar pauta',
    updated_at: '2026-07-01T10:00:00.000Z',
    assignee_id: null,
    ...overrides,
  };
}

function buildProject(overrides: Partial<ProjectWorkspaceProject>): ProjectWorkspaceProject {
  return {
    id: 'project-1',
    accountName: 'Kianda',
    account_id: 'account-1',
    completedTaskCount: 0,
    created_at: '2026-07-01T10:00:00.000Z',
    description: null,
    due_date: '2026-07-08T12:00:00.000Z',
    organization_id: 'org-1',
    ownerName: null,
    owner_id: 'user-1',
    project_type: 'monthly',
    start_date: '2026-07-01',
    status: 'active',
    taskCount: 4,
    title: 'Onboarding',
    updated_at: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('operations alerts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates relative dates from today', () => {
    expect(daysFromToday('2026-07-09T12:00:00.000Z')).toBe(0);
    expect(relativeDueLabel('2026-07-09T12:00:00.000Z')).toBe('Hoje');
    expect(relativeDueLabel('2026-07-10T12:00:00.000Z')).toBe('Amanha');
    expect(relativeDueLabel('2026-07-08T12:00:00.000Z')).toBe('Atrasado ha 1 dia(s)');
  });

  it('builds critical and due-soon alerts with counts', () => {
    const alerts = buildOperationalAlerts({
      financials: { lateInvoices: 2, mrr: 5000, pendingInvoices: 1 },
      leads: [
        buildLead({}),
        buildLead({
          account: { ...buildLead({}).account, id: 'account-2', display_name: 'Vistta' },
          opportunity: {
            ...buildLead({}).opportunity,
            id: 'opp-2',
            title: 'Bio Sprint',
            next_follow_up_at: '2026-07-09T15:00:00.000Z',
          },
        }),
      ],
      tasks: [
        buildTask({}),
        buildTask({
          id: 'task-2',
          title: 'Revisar cronograma',
          due_date: '2026-07-09T12:00:00.000Z',
          priority: 'medium',
        }),
        buildTask({
          id: 'task-3',
          title: 'Subir materiais',
          due_date: '2026-07-11T12:00:00.000Z',
          priority: 'low',
        }),
      ],
      projects: [
        buildProject({}),
        buildProject({
          id: 'project-2',
          title: 'Expansao',
          accountName: 'Vistta',
          due_date: '2026-07-13T12:00:00.000Z',
        }),
      ],
    });

    expect(alerts.counts.overdueFollowUps).toBe(1);
    expect(alerts.counts.todayFollowUps).toBe(1);
    expect(alerts.counts.overdueTasks).toBe(1);
    expect(alerts.counts.todayTasks).toBe(1);
    expect(alerts.counts.overdueProjects).toBe(1);

    expect(alerts.criticalAlerts.some((alert) => alert.kind === 'billing')).toBe(true);
    expect(alerts.criticalAlerts[0]?.tone).toBe('danger');
    expect(alerts.dueSoonAlerts.some((alert) => alert.title === 'Bio Sprint')).toBe(true);
    expect(alerts.dueSoonAlerts.some((alert) => alert.title === 'Subir materiais')).toBe(true);
  });

  it('derives financial snapshot from client services and cycles', () => {
    const services: ClientService[] = [
      {
        id: 'service-1',
        account_id: 'account-1',
        billing_day: 10,
        closed_at: null,
        contracted_price: 1500,
        created_at: '2026-07-01T10:00:00.000Z',
        organization_id: 'org-1',
        recurrence: 'monthly',
        service_catalog_id: 'catalog-1',
        status: 'active',
        updated_at: '2026-07-01T10:00:00.000Z',
        valid_until: null,
      },
      {
        id: 'service-2',
        account_id: 'account-1',
        billing_day: null,
        closed_at: null,
        contracted_price: 800,
        created_at: '2026-07-01T10:00:00.000Z',
        organization_id: 'org-1',
        recurrence: 'one_off',
        service_catalog_id: 'catalog-2',
        status: 'active',
        updated_at: '2026-07-01T10:00:00.000Z',
        valid_until: null,
      },
    ];

    const cycles: BillingCycle[] = [
      {
        id: 'cycle-1',
        account_id: 'account-1',
        amount: 1500,
        client_service_id: 'service-1',
        created_at: '2026-07-01T10:00:00.000Z',
        due_date: '2026-07-10',
        organization_id: 'org-1',
        paid_at: null,
        reference_month: '2026-07',
        status: 'pending',
        updated_at: '2026-07-01T10:00:00.000Z',
      },
      {
        id: 'cycle-2',
        account_id: 'account-1',
        amount: 1500,
        client_service_id: 'service-1',
        created_at: '2026-07-01T10:00:00.000Z',
        due_date: '2026-06-10',
        organization_id: 'org-1',
        paid_at: null,
        reference_month: '2026-06',
        status: 'late',
        updated_at: '2026-07-01T10:00:00.000Z',
      },
    ];

    expect(deriveLocalFinancials(services, cycles)).toEqual({
      lateInvoices: 1,
      mrr: 1500,
      pendingInvoices: 1,
    });
  });

  it('maps alert kinds and routes consistently', () => {
    expect(alertKindLabel('follow_up')).toBe('Follow-up');
    expect(routeForAlertKind('project')).toBe('/app/projetos');
    expect(
      routeForAlert({
        kind: 'billing',
        title: 'Faturas atrasadas',
        target: 'Financeiro',
        dueLabel: '2 pendencia(s)',
        tone: 'danger',
      }),
    ).toBe('/app/calendario?kind=billing&focus=critical');
    expect(
      routeForAlert({
        kind: 'follow_up',
        title: 'Plano Mensal',
        target: 'Kianda',
        dueLabel: 'Hoje',
        tone: 'brand',
      }),
    ).toBe('/app/leads?followUp=today');
  });
});
