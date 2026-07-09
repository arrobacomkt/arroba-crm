import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarClock,
  CircleDollarSign,
  Flame,
  Handshake,
  Loader2,
  type LucideIcon,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { startOfToday } from '@/features/operations/alerts';
import { formatBrl } from '@/lib/formatters/brl';
import type { OpportunityLineItem, PipelineStage } from '@/types/database';

import { type CommercialLead, initialCommercialLeads, pipelineStages } from './commercial-data';
import {
  type UpdateOpportunityDetailsInput,
  commercialQueryKey,
  createCommercialLead,
  createOpportunityLineItem,
  deleteOpportunityLineItem,
  fetchCommercialData,
  fetchOpportunityLineItems,
  updateOpportunityDetails,
  updateOpportunityStage,
} from './commercial-queries';
import { ConvertClientModal } from './convert-client-modal';

const leadSchema = z.object({
  displayName: z.string().min(2, 'Informe o nome da empresa.'),
  segment: z.string().min(2, 'Informe o segmento.'),
  city: z.string().min(2, 'Informe a cidade.'),
  source: z.string().min(2, 'Informe a origem.'),
  contactName: z.string().min(2, 'Informe o contato principal.'),
  whatsapp: z.string().optional(),
  temperature: z.enum(['hot', 'warm', 'cold']),
  opportunityTitle: z.string().min(2, 'Informe a oportunidade.'),
  estimatedValue: z.coerce.number().min(0, 'Valor inválido.'),
});

type LeadFormValues = z.output<typeof leadSchema>;
type LeadFormInput = z.input<typeof leadSchema>;
type FollowUpBucket = 'overdue' | 'today' | 'upcoming';

function toDatetimeLocalValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function formatFollowUpLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Follow-up agendado';
  return `Follow-up ${date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
}

function getFollowUpBucket(
  value: string | null,
  todayStart: Date,
  tomorrowStart: Date,
): FollowUpBucket | null {
  if (!value) return null;
  const followUp = new Date(value);
  if (Number.isNaN(followUp.getTime())) return null;
  if (followUp < todayStart) return 'overdue';
  if (followUp < tomorrowStart) return 'today';
  return 'upcoming';
}

function createLocalLead(values: LeadFormValues): CommercialLead {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    account: {
      id: `account-${id}`,
      organization_id: 'org-arroba-local',
      lifecycle_status: 'lead',
      status: 'active',
      display_name: values.displayName,
      legal_name: null,
      cnpj: null,
      segment: values.segment,
      city: values.city,
      state: 'ES',
      address: null,
      instagram_url: null,
      website_url: null,
      lead_temperature: values.temperature,
      lead_source: values.source,
      owner_id: 'user-davi-local',
      strategic_notes: null,
      created_by: 'user-davi-local',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    contact: {
      id: `contact-${id}`,
      organization_id: 'org-arroba-local',
      account_id: `account-${id}`,
      full_name: values.contactName,
      role_title: null,
      phone: null,
      whatsapp: values.whatsapp || null,
      email: null,
      is_primary: true,
      notes: null,
      created_at: now,
      updated_at: now,
    },
    opportunity: {
      id: `opp-${id}`,
      organization_id: 'org-arroba-local',
      account_id: `account-${id}`,
      primary_contact_id: `contact-${id}`,
      pipeline_stage_id: 'stage-new',
      title: values.opportunityTitle,
      estimated_value: values.estimatedValue,
      expected_close_date: null,
      proposal_valid_until: null,
      owner_id: 'user-davi-local',
      next_follow_up_at: null,
      lost_reason: null,
      won_at: null,
      lost_at: null,
      converted_at: null,
      created_at: now,
      updated_at: now,
    },
  };
}

function applyWonConversion(
  lead: CommercialLead,
  stage: PipelineStage,
  now: string,
): CommercialLead {
  if (stage.stage_group !== 'won') {
    return {
      ...lead,
      opportunity: { ...lead.opportunity, pipeline_stage_id: stage.id, updated_at: now },
    };
  }
  return {
    ...lead,
    account: { ...lead.account, lifecycle_status: 'client' },
    opportunity: {
      ...lead.opportunity,
      pipeline_stage_id: stage.id,
      won_at: lead.opportunity.won_at ?? now,
      converted_at: lead.opportunity.converted_at ?? now,
      updated_at: now,
      lost_at: null,
      lost_reason: null,
    },
  };
}

export function CommercialPage() {
  const { isSupabaseConfigured, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';
  const queryClient = useQueryClient();

  const [localLeads, setLocalLeads] = useState(initialCommercialLeads);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeOpportunityId, setActiveOpportunityId] = useState<string | null>(null);
  const [editingOpportunityId, setEditingOpportunityId] = useState<string | null>(null);
  const [convertingOpportunityId, setConvertingOpportunityId] = useState<string | null>(null);
  const [lostReasonLead, setLostReasonLead] = useState<CommercialLead | null>(null);
  const [lostReasonText, setLostReasonText] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const commercialQuery = useQuery({
    queryKey: commercialQueryKey,
    queryFn: fetchCommercialData,
    enabled: hasRealSession,
  });

  const updateStageMutation = useMutation({
    mutationFn: updateOpportunityStage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commercialQueryKey });
      toast.success('Etapa atualizada.');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateDetailsMutation = useMutation({
    mutationFn: updateOpportunityDetails,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commercialQueryKey });
      toast.success('Oportunidade atualizada.');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isSaving = updateDetailsMutation.isPending || updateStageMutation.isPending;

  const leads: CommercialLead[] = useMemo(
    () => (hasRealSession ? (commercialQuery.data?.leads ?? []) : localLeads),
    [commercialQuery.data?.leads, hasRealSession, localLeads],
  );

  const stages = useMemo(() => {
    if (hasRealSession && commercialQuery.data?.stages.length) return commercialQuery.data.stages;
    return pipelineStages;
  }, [hasRealSession, commercialQuery.data]);

  const openStageIds = useMemo(
    () => new Set(stages.filter((s) => s.stage_group === 'open').map((s) => s.id)),
    [stages],
  );
  const stageNamesById = useMemo(
    () => new Map(stages.map((stage) => [stage.id, stage.name] as const)),
    [stages],
  );

  const summary = useMemo(() => {
    const openLeads = leads.filter((l) => openStageIds.has(l.opportunity.pipeline_stage_id));
    return {
      openLeads: openLeads.length,
      estimatedValue: openLeads.reduce((t, l) => t + (l.opportunity.estimated_value ?? 0), 0),
      hotLeads: leads.filter(
        (l) =>
          l.account.lead_temperature === 'hot' && openStageIds.has(l.opportunity.pipeline_stage_id),
      ).length,
      followUps: leads.filter((l) => Boolean(l.opportunity.next_follow_up_at)).length,
    };
  }, [leads, openStageIds]);

  const editingLead = useMemo(
    () => leads.find((l) => l.opportunity.id === editingOpportunityId) ?? null,
    [editingOpportunityId, leads],
  );
  const activeLead = useMemo(
    () => leads.find((lead) => lead.opportunity.id === activeOpportunityId) ?? null,
    [activeOpportunityId, leads],
  );
  const convertingLead = useMemo(
    () => leads.find((l) => l.opportunity.id === convertingOpportunityId) ?? null,
    [convertingOpportunityId, leads],
  );

  const filteredLeads = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const followUpFilter = searchParams.get('followUp');
    const todayStart = startOfToday();
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    return leads.filter((lead) => {
      const matchesFilter =
        !followUpFilter ||
        getFollowUpBucket(lead.opportunity.next_follow_up_at, todayStart, tomorrowStart) ===
          followUpFilter;
      if (!matchesFilter) return false;
      if (!term) return true;
      return [
        [
          lead.account.display_name,
          lead.contact.full_name,
          lead.opportunity.title,
          lead.account.segment,
          lead.account.city,
        ].some((f) => f?.toLowerCase().includes(term)),
      ][0];
    });
  }, [leads, searchParams, searchTerm]);

  const followUpAgenda = useMemo(() => {
    const todayStart = startOfToday();
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    const items = leads
      .filter(
        (lead) =>
          openStageIds.has(lead.opportunity.pipeline_stage_id) && lead.opportunity.next_follow_up_at,
      )
      .map((lead) => {
        const bucket = getFollowUpBucket(
          lead.opportunity.next_follow_up_at,
          todayStart,
          tomorrowStart,
        );
        if (!bucket) return null;
        return {
          lead,
          bucket,
          followUpAt: new Date(lead.opportunity.next_follow_up_at as string),
        };
      })
      .filter((item): item is { lead: CommercialLead; bucket: FollowUpBucket; followUpAt: Date } =>
        Boolean(item),
      )
      .sort((a, b) => a.followUpAt.getTime() - b.followUpAt.getTime());

    return {
      overdue: items.filter((item) => item.bucket === 'overdue'),
      today: items.filter((item) => item.bucket === 'today'),
      upcoming: items.filter((item) => item.bucket === 'upcoming'),
      items,
    };
  }, [leads, openStageIds]);

  function handleSetFollowUpFilter(filter: FollowUpBucket | null) {
    const next = new URLSearchParams(searchParams);
    if (filter) {
      next.set('followUp', filter);
    } else {
      next.delete('followUp');
    }
    setSearchParams(next);
  }

  const form = useForm<LeadFormInput, unknown, LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      displayName: '',
      segment: '',
      city: '',
      source: '',
      contactName: '',
      whatsapp: '',
      temperature: 'hot',
      opportunityTitle: '',
      estimatedValue: 0,
    },
  });

  async function handleCreateLead(values: LeadFormValues) {
    if (hasRealSession) {
      createCommercialLead(values)
        .then(async () => {
          await queryClient.invalidateQueries({ queryKey: commercialQueryKey });
          toast.success('Lead cadastrado!');
          form.reset();
          setShowForm(false);
        })
        .catch((error) => {
          toast.error(error.message);
        });
      return;
    }
    setLocalLeads((c) => [createLocalLead(values), ...c]);
    toast.success('Lead cadastrado no modo local.');
    form.reset();
    setShowForm(false);
  }

  function handleMoveOpportunity(lead: CommercialLead, pipelineStageId: string) {
    if (lead.opportunity.pipeline_stage_id === pipelineStageId) return;
    const stage = stages.find((s) => s.id === pipelineStageId);
    if (!stage) {
      toast.error('Etapa nao encontrada.');
      return;
    }
    if (stage.stage_group === 'won') {
      setConvertingOpportunityId(lead.opportunity.id);
      return;
    }
    if (stage.stage_group === 'lost') {
      setLostReasonLead(lead);
      setLostReasonText('');
      return;
    }
    if (hasRealSession) {
      updateStageMutation.mutate({
        accountId: lead.account.id,
        opportunityId: lead.opportunity.id,
        pipelineStageId,
        pipelineStageGroup: stage.stage_group,
      });
      return;
    }
    const now = new Date().toISOString();
    setLocalLeads((c) =>
      c.map((cl) =>
        cl.opportunity.id === lead.opportunity.id
          ? applyWonConversion(
              {
                ...cl,
                opportunity: {
                  ...cl.opportunity,
                  pipeline_stage_id: pipelineStageId,
                  updated_at: now,
                },
              },
              stage,
              now,
            )
          : cl,
      ),
    );
    toast.success('Etapa atualizada no modo local.');
  }

  function handleConfirmLost() {
    if (!lostReasonLead) return;
    const reason = lostReasonText.trim();
    if (!reason) {
      toast.error('Informe o motivo da perda.');
      return;
    }
    const lostStage = stages.find((s) => s.stage_group === 'lost');
    if (!lostStage) {
      toast.error('Etapa de perda não encontrada.');
      return;
    }
    if (hasRealSession) {
      updateStageMutation.mutate({
        accountId: lostReasonLead.account.id,
        opportunityId: lostReasonLead.opportunity.id,
        pipelineStageId: lostStage.id,
        pipelineStageGroup: 'lost',
        lostReason: reason,
      });
    } else {
      const now = new Date().toISOString();
      setLocalLeads((c) =>
        c.map((l) =>
          l.opportunity.id === lostReasonLead.opportunity.id
            ? {
                ...l,
                opportunity: {
                  ...l.opportunity,
                  pipeline_stage_id: lostStage.id,
                  lost_at: now,
                  lost_reason: reason,
                  won_at: null,
                  converted_at: null,
                  updated_at: now,
                },
              }
            : l,
        ),
      );
      toast.success('Lead marcado como perdido.');
    }
    setLostReasonLead(null);
    setLostReasonText('');
  }

  function handleUpdateOpportunityDetails(values: UpdateOpportunityDetailsInput) {
    if (values.pipelineStageGroup === 'won') {
      toast.info('Arraste para Fechado ganho para converter.');
      return;
    }
    if (hasRealSession) {
      updateDetailsMutation.mutate(values);
      setEditingOpportunityId(null);
      return;
    }
    const stage = stages.find((s) => s.id === values.pipelineStageId);
    if (!stage) {
      toast.error('Etapa nao encontrada.');
      return;
    }
    const now = new Date().toISOString();
    setLocalLeads((c) =>
      c.map((cl) =>
        cl.opportunity.id === values.opportunityId
          ? applyWonConversion(
              {
                ...cl,
                opportunity: {
                  ...cl.opportunity,
                  title: values.title,
                  estimated_value: values.estimatedValue,
                  next_follow_up_at: values.nextFollowUpAt,
                  pipeline_stage_id: values.pipelineStageId,
                  updated_at: now,
                },
              },
              stage,
              now,
            )
          : cl,
      ),
    );
    toast.success('Oportunidade atualizada no modo local.');
    setEditingOpportunityId(null);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveOpportunityId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const opportunityId = String(event.active.id);
    const targetStageId = event.over ? String(event.over.id) : null;
    const lead = leads.find((l) => l.opportunity.id === opportunityId);
    setActiveOpportunityId(null);
    if (!lead || !targetStageId) return;
    handleMoveOpportunity(lead, targetStageId);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Leads, contatos, oportunidades, propostas e follow-ups.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {searchParams.get('followUp') ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('followUp');
                setSearchParams(next);
              }}
            >
              Limpar filtro
            </Button>
          ) : null}
          <Button type="button" onClick={() => setShowForm((v) => !v)}>
            <Plus size={18} /> Novo lead
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Handshake} label="Leads abertos" value={String(summary.openLeads)} />
        <MetricCard
          icon={CircleDollarSign}
          label="Valor estimado"
          value={formatBrl(summary.estimatedValue)}
        />
        <MetricCard icon={Flame} label="Leads quentes" value={String(summary.hotLeads)} />
        <MetricCard icon={CalendarClock} label="Follow-ups" value={String(summary.followUps)} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-semibold">Agenda de follow-up</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Prioridades comerciais para o time agir hoje.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={!searchParams.get('followUp') ? 'primary' : 'secondary'}
                className="h-8 px-3 text-xs"
                onClick={() => handleSetFollowUpFilter(null)}
              >
                Todos ({followUpAgenda.items.length})
              </Button>
              <Button
                type="button"
                variant={searchParams.get('followUp') === 'overdue' ? 'primary' : 'secondary'}
                className="h-8 px-3 text-xs"
                onClick={() => handleSetFollowUpFilter('overdue')}
              >
                Atrasados ({followUpAgenda.overdue.length})
              </Button>
              <Button
                type="button"
                variant={searchParams.get('followUp') === 'today' ? 'primary' : 'secondary'}
                className="h-8 px-3 text-xs"
                onClick={() => handleSetFollowUpFilter('today')}
              >
                Hoje ({followUpAgenda.today.length})
              </Button>
              <Button
                type="button"
                variant={searchParams.get('followUp') === 'upcoming' ? 'primary' : 'secondary'}
                className="h-8 px-3 text-xs"
                onClick={() => handleSetFollowUpFilter('upcoming')}
              >
                PrÃ³ximos ({followUpAgenda.upcoming.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {followUpAgenda.items.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum follow-up agendado nas etapas abertas.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-3">
              {followUpAgenda.items.slice(0, 6).map(({ lead, bucket, followUpAt }) => (
                <div key={lead.opportunity.id} className="rounded-md border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {lead.account.display_name}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            bucket === 'overdue'
                              ? 'bg-danger/10 text-danger'
                              : bucket === 'today'
                                ? 'bg-warning/10 text-warning'
                                : 'bg-brand/10 text-brand'
                          }`}
                        >
                          {bucket === 'overdue'
                            ? 'Atrasado'
                            : bucket === 'today'
                              ? 'Hoje'
                              : 'PrÃ³ximo'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {lead.opportunity.title}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 px-0"
                      title="Editar oportunidade"
                      onClick={() => setEditingOpportunityId(lead.opportunity.id)}
                    >
                      <Pencil size={14} />
                    </Button>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    <p>{lead.contact.full_name}</p>
                    <p>{formatFollowUpLabel(followUpAt.toISOString())}</p>
                    <p>
                      Etapa atual:{' '}
                      <span className="font-medium text-foreground">
                        {stageNamesById.get(lead.opportunity.pipeline_stage_id) ?? 'Sem etapa'}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {hasRealSession && commercialQuery.isError ? (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="flex gap-3 p-4 text-sm text-danger">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold">Nao foi possivel carregar o pipeline do Supabase.</p>
              <p className="mt-1 text-danger/80">{commercialQuery.error.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showForm ? (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Cadastrar lead</h2>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 lg:grid-cols-4"
              onSubmit={form.handleSubmit(handleCreateLead)}
            >
              <Input placeholder="Empresa" {...form.register('displayName')} />
              <Input placeholder="Segmento" {...form.register('segment')} />
              <Input placeholder="Cidade" {...form.register('city')} />
              <Input placeholder="Origem" {...form.register('source')} />
              <Input placeholder="Contato principal" {...form.register('contactName')} />
              <Input placeholder="WhatsApp (opcional)" {...form.register('whatsapp')} />
              <select
                className="h-10 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                {...form.register('temperature')}
              >
                <option value="hot">Quente</option>
                <option value="warm">Morno</option>
                <option value="cold">Frio</option>
              </select>
              <Input placeholder="Oportunidade" {...form.register('opportunityTitle')} />
              <Input
                min={0}
                placeholder="Valor estimado"
                step="0.01"
                type="number"
                {...form.register('estimatedValue')}
              />
              <div className="flex items-end gap-2 lg:col-span-4">
                <Button type="submit">
                  <Save size={16} /> Cadastrar
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">Pipeline</h2>
            <div className="relative w-full max-w-80">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                className="pl-9"
                placeholder="Buscar por lead, contato ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {searchTerm && filteredLeads.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado para "<strong>{searchTerm}</strong>".
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragCancel={() => setActiveOpportunityId(null)}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 overflow-x-auto pb-2">
                {stages.map((stage) => (
                  <PipelineColumn
                    key={stage.id}
                    stage={stage}
                    leads={filteredLeads.filter(
                      (l) => l.opportunity.pipeline_stage_id === stage.id,
                    )}
                    onEditOpportunity={(lead) => setEditingOpportunityId(lead.opportunity.id)}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeLead ? (
                  <LeadCard lead={activeLead} isDragging onEditOpportunity={() => undefined} />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {editingLead ? (
        <OpportunityEditModal
          lead={editingLead}
          stages={stages}
          isSaving={isSaving}
          onClose={() => setEditingOpportunityId(null)}
          onSubmit={handleUpdateOpportunityDetails}
        />
      ) : null}

      {lostReasonLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            aria-modal="true"
            className="w-full max-w-md rounded-md border border-border bg-card shadow-xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold text-lg text-danger">Perder Oportunidade</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lostReasonLead.account.display_name} — {lostReasonLead.opportunity.title}
                </p>
              </div>
              <button
                type="button"
                className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:bg-muted"
                onClick={() => setLostReasonLead(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Informe o motivo pelo qual esta oportunidade foi perdida. Este campo é obrigatório
                para mover o lead para <strong>Fechado perdido</strong>.
              </p>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Motivo da perda</span>
                <textarea
                  className="h-24 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none resize-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  value={lostReasonText}
                  onChange={(e) => setLostReasonText(e.target.value)}
                  placeholder="Ex: Não tinha orçamento, Escolheu concorrente..."
                  autoFocus
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setLostReasonLead(null)}>
                  Cancelar
                </Button>
                <Button type="button" variant="danger" onClick={handleConfirmLost}>
                  <X size={16} className="mr-1" /> Confirmar Perda
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {convertingLead ? (
        <ConvertClientModal
          lead={convertingLead}
          onClose={() => setConvertingOpportunityId(null)}
          onSuccess={() => {
            setConvertingOpportunityId(null);
            if (!hasRealSession) {
              const stage = stages.find((s) => s.stage_group === 'won');
              if (stage) {
                const now = new Date().toISOString();
                setLocalLeads((c) =>
                  c.map((cl) =>
                    cl.opportunity.id === convertingLead.opportunity.id
                      ? applyWonConversion(
                          {
                            ...cl,
                            opportunity: {
                              ...cl.opportunity,
                              pipeline_stage_id: stage.id,
                              updated_at: now,
                            },
                          },
                          stage,
                          now,
                        )
                      : cl,
                  ),
                );
              }
            }
          }}
        />
      ) : null}
    </div>
  );
}

type MetricCardProps = { icon: LucideIcon; label: string; value: string };
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

type FieldProps = { label: string; error?: string; children: ReactNode };
function Field({ label, error, children }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs font-medium text-danger">{error}</span> : null}
    </label>
  );
}

type PipelineColumnProps = {
  stage: PipelineStage;
  leads: CommercialLead[];
  onEditOpportunity: (lead: CommercialLead) => void;
};
function PipelineColumn({ stage, leads, onEditOpportunity }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const toneMap: Record<string, string> = {
    brand: 'border-brand/20 bg-brand/5',
    warning: 'border-warning/20 bg-warning/5',
    success: 'border-success/20 bg-success/5',
    neutral: 'border-neutral/20 bg-neutral/5',
  };
  const borderColor = stage.color_token ? toneMap[stage.color_token] : toneMap.neutral;
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-md border ${borderColor} ${isOver ? 'ring-2 ring-brand/30' : ''}`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold">{stage.name}</span>
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {leads.map((lead) => (
          <LeadCard
            key={lead.opportunity.id}
            lead={lead}
            isDragging={false}
            onEditOpportunity={onEditOpportunity}
          />
        ))}
        {leads.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Arraste um lead para cá
          </div>
        ) : null}
      </div>
    </div>
  );
}

type LeadCardProps = {
  lead: CommercialLead;
  isDragging: boolean;
  onEditOpportunity: (lead: CommercialLead) => void;
};
function LeadCard({ lead, isDragging, onEditOpportunity }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: lead.opportunity.id,
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const temperatureColors: Record<string, string> = {
    hot: 'text-danger',
    warm: 'text-warning',
    cold: 'text-muted-foreground',
  };
  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border border-border bg-card p-3 ${isDragging ? 'shadow-lg opacity-80' : 'shadow-sm'} ${!isDragging ? 'cursor-grab hover:border-brand/50' : ''}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug">{lead.account.display_name}</p>
        <div className="flex items-center gap-1 shrink-0">
          {lead.account.lead_temperature ? (
            <span
              className={
                temperatureColors[lead.account.lead_temperature] ?? 'text-muted-foreground'
              }
            >
              {lead.account.lead_temperature === 'hot' ? (
                <Flame size={14} />
              ) : (
                <CalendarClock size={14} />
              )}
            </span>
          ) : null}
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted"
            onClick={() => onEditOpportunity(lead)}
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{lead.opportunity.title}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold data-tabular">
          {formatBrl(lead.opportunity.estimated_value ?? 0)}
        </span>
        {lead.opportunity.next_follow_up_at ? (
          <span className="text-xs leading-relaxed text-muted-foreground truncate">
            {formatFollowUpLabel(lead.opportunity.next_follow_up_at)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type OpportunityEditModalProps = {
  lead: CommercialLead;
  stages: PipelineStage[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: UpdateOpportunityDetailsInput) => void;
};

function OpportunityEditModal({
  lead,
  stages,
  isSaving,
  onClose,
  onSubmit,
}: OpportunityEditModalProps) {
  const { isSupabaseConfigured, user } = useAuth();
  const hasRealSession = isSupabaseConfigured && Boolean(user) && user?.id !== 'local-richards';

  const [title, setTitle] = useState(lead.opportunity.title);
  const [estimatedValue, setEstimatedValue] = useState(
    String(lead.opportunity.estimated_value ?? 0),
  );
  const [nextFollowUpAt, setNextFollowUpAt] = useState(
    toDatetimeLocalValue(lead.opportunity.next_follow_up_at),
  );
  const [pipelineStageId, setPipelineStageId] = useState(lead.opportunity.pipeline_stage_id);
  const [lineItems, setLineItems] = useState<OpportunityLineItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(hasRealSession);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemDescription, setItemDescription] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemUnitValue, setItemUnitValue] = useState('');
  const [itemRecurrence, setItemRecurrence] = useState<'one_off' | 'monthly'>('one_off');
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRealSession) return;

    let isCurrent = true;
    fetchOpportunityLineItems(lead.opportunity.id)
      .then((items) => {
        if (isCurrent) setLineItems(items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (isCurrent) setLoadingItems(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [hasRealSession, lead.opportunity.id]);

  async function handleAddItem() {
    const desc = itemDescription.trim();
    const qty = Number(itemQuantity);
    const unitVal = Number(itemUnitValue);
    if (!desc || Number.isNaN(qty) || qty <= 0 || Number.isNaN(unitVal) || unitVal < 0) {
      toast.error('Preencha descrição, quantidade e valor unitário.');
      return;
    }
    if (hasRealSession) {
      try {
        const newItem = await createOpportunityLineItem({
          opportunityId: lead.opportunity.id,
          description: desc,
          quantity: qty,
          unitValue: unitVal,
          recurrence: itemRecurrence,
        });
        setLineItems((c) => [...c, newItem]);
      } catch (err) {
        toast.error((err as Error).message);
        return;
      }
    } else {
      setLineItems((c) => [
        ...c,
        {
          id: crypto.randomUUID(),
          opportunity_id: lead.opportunity.id,
          service_catalog_id: null,
          description: desc,
          quantity: qty,
          unit_value: unitVal,
          total_value: qty * unitVal,
          recurrence: itemRecurrence,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setItemDescription('');
    setItemQuantity('1');
    setItemUnitValue('');
    setItemRecurrence('one_off');
    setShowAddItem(false);
    toast.success('Item adicionado à proposta.');
  }

  async function handleDeleteItem(id: string) {
    setDeletingItemId(id);
    if (hasRealSession) {
      try {
        await deleteOpportunityLineItem(id);
      } catch (err) {
        toast.error((err as Error).message);
        setDeletingItemId(null);
        return;
      }
    }
    setLineItems((c) => c.filter((i) => i.id !== id));
    setDeletingItemId(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanEstimatedValue = Number(estimatedValue || 0);
    const stage = stages.find((s) => s.id === pipelineStageId);
    if (!cleanTitle || Number.isNaN(cleanEstimatedValue) || cleanEstimatedValue < 0) {
      toast.error('Revise titulo e valor da oportunidade.');
      return;
    }
    if (!stage) {
      toast.error('Etapa nao encontrada.');
      return;
    }
    onSubmit({
      accountId: lead.account.id,
      opportunityId: lead.opportunity.id,
      title: cleanTitle,
      estimatedValue: cleanEstimatedValue,
      nextFollowUpAt: fromDatetimeLocalValue(nextFollowUpAt),
      pipelineStageId,
      pipelineStageGroup: stage.stage_group,
    });
  }

  const totalProposal = lineItems.reduce((sum, item) => sum + Number(item.total_value), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        aria-modal="true"
        className="flex w-full max-w-2xl max-h-[90vh] flex-col rounded-md border border-border bg-card shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 shrink-0">
          <div>
            <h2 className="font-semibold">Editar oportunidade</h2>
            <p className="mt-1 text-sm text-muted-foreground">{lead.account.display_name}</p>
          </div>
          <Button
            className="h-8 w-8 px-0"
            type="button"
            title="Fechar"
            variant="ghost"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Oportunidade">
              <Input value={title} disabled={isSaving} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor estimado">
                <Input
                  min={0}
                  step="0.01"
                  type="number"
                  value={estimatedValue}
                  disabled={isSaving}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                />
              </Field>
              <Field label="Próximo follow-up">
                <Input
                  type="datetime-local"
                  value={nextFollowUpAt}
                  disabled={isSaving}
                  onChange={(e) => setNextFollowUpAt(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Etapa">
              <select
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                value={pipelineStageId}
                disabled={isSaving}
                onChange={(e) => setPipelineStageId(e.target.value)}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="border-t border-border pt-4 mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Itens da Proposta</h3>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 text-xs"
                  onClick={() => setShowAddItem(true)}
                  disabled={showAddItem}
                >
                  <Plus size={14} className="mr-1" /> Adicionar item
                </Button>
              </div>

              {loadingItems ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin mr-2" size={16} /> Carregando itens...
                </div>
              ) : showAddItem ? (
                <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3 mb-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                    Novo item
                  </h4>
                  <Field label="Descrição">
                    <Input
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      placeholder="Ex: Criação de identidade visual"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Quantidade">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(e.target.value)}
                      />
                    </Field>
                    <Field label="Valor unitário (R$)">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={itemUnitValue}
                        onChange={(e) => setItemUnitValue(e.target.value)}
                      />
                    </Field>
                    <Field label="Recorrência">
                      <select
                        className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                        value={itemRecurrence}
                        onChange={(e) => setItemRecurrence(e.target.value as 'one_off' | 'monthly')}
                      >
                        <option value="one_off">Única</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8 text-xs"
                      onClick={() => {
                        setShowAddItem(false);
                        setItemDescription('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="button" className="h-8 text-xs" onClick={handleAddItem}>
                      <Plus size={14} className="mr-1" /> Adicionar
                    </Button>
                  </div>
                </div>
              ) : null}

              {lineItems.length > 0 ? (
                <div className="space-y-2">
                  {lineItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity}x {formatBrl(Number(item.unit_value))} ·{' '}
                          {item.recurrence === 'monthly' ? 'Mensal' : 'Única'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold data-tabular">
                          {formatBrl(Number(item.total_value))}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 px-0 text-danger shrink-0"
                        disabled={deletingItemId === item.id}
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        {deletingItemId === item.id ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-end pt-2 border-t border-border">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total da proposta</p>
                      <p className="text-lg font-bold data-tabular">{formatBrl(totalProposal)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {!showAddItem
                    ? 'Nenhum item na proposta. Clique em "Adicionar item" para incluir.'
                    : null}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
              <Button type="button" variant="secondary" disabled={isSaving} onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}{' '}
                Salvar
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
