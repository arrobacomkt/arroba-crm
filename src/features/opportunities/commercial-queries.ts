import { supabase } from '@/integrations/supabase/client';
import type {
  Account,
  Contact,
  Json,
  Opportunity,
  OpportunityLineItem,
  PipelineStage,
} from '@/types/database';

import type { CommercialLead } from './commercial-data';

export const commercialQueryKey = ['commercial'] as const;

export type CreateCommercialLeadInput = {
  displayName: string;
  segment: string;
  city: string;
  source: string;
  contactName: string;
  whatsapp?: string;
  temperature: 'hot' | 'warm' | 'cold';
  opportunityTitle: string;
  estimatedValue: number;
};

export type UpdateOpportunityDetailsInput = {
  accountId: string;
  opportunityId: string;
  title: string;
  estimatedValue: number;
  nextFollowUpAt: string | null;
  pipelineStageId: string;
  pipelineStageGroup: 'open' | 'won' | 'lost';
};

export type ConvertClientInput = {
  opportunityId: string;
  services: Array<{
    service_catalog_id: string;
    contracted_price: number;
    recurrence: 'monthly' | 'one_off';
    billing_day: number | null;
    account_unit_ids: string[];
  }>;
};

export type UpdateOpportunityStageInput = {
  accountId: string;
  opportunityId: string;
  pipelineStageId: string;
  pipelineStageGroup: 'open' | 'won' | 'lost';
  lostReason?: string | null;
};

export type CommercialData = {
  organizationId: string;
  stages: PipelineStage[];
  leads: CommercialLead[];
};

async function getCurrentOrganizationId() {
  if (!supabase) {
    throw new Error('Supabase nao configurado.');
  }

  const { data, error } = await supabase.rpc('current_org_ids');
  if (error) throw error;

  const organizationId = data.at(0);
  if (!organizationId) {
    throw new Error('Usuario sem organizacao ativa. Vincule o usuario a Arroba Co.');
  }

  return organizationId;
}

export async function fetchCommercialData(): Promise<CommercialData> {
  if (!supabase) {
    throw new Error('Supabase nao configurado.');
  }

  const organizationId = await getCurrentOrganizationId();

  const [stagesResult, accountsResult, contactsResult, opportunitiesResult] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('position', { ascending: true }),
    supabase
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('contacts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true }),
    supabase
      .from('opportunities')
      .select('*')
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }),
  ]);

  if (stagesResult.error) throw stagesResult.error;
  if (accountsResult.error) throw accountsResult.error;
  if (contactsResult.error) throw contactsResult.error;
  if (opportunitiesResult.error) throw opportunitiesResult.error;

  const accountsById = new Map(
    (accountsResult.data ?? []).map((account) => [account.id, account] as const),
  );
  const contactsById = new Map(
    (contactsResult.data ?? []).map((contact) => [contact.id, contact] as const),
  );
  const primaryContactsByAccountId = new Map<string, Contact>();

  for (const contact of contactsResult.data ?? []) {
    const current = primaryContactsByAccountId.get(contact.account_id);
    if (!current || contact.is_primary) {
      primaryContactsByAccountId.set(contact.account_id, contact);
    }
  }

  const leads = (opportunitiesResult.data ?? []).flatMap((opportunity) => {
    const account = accountsById.get(opportunity.account_id);
    const contact =
      (opportunity.primary_contact_id ? contactsById.get(opportunity.primary_contact_id) : null) ??
      primaryContactsByAccountId.get(opportunity.account_id);

    if (!account || !contact) return [];

    return [{ account, contact, opportunity }];
  });

  return {
    organizationId,
    stages: stagesResult.data ?? [],
    leads,
  };
}

export async function createCommercialLead(values: CreateCommercialLeadInput) {
  if (!supabase) {
    throw new Error('Supabase nao configurado.');
  }

  const [{ data: userData, error: userError }, organizationId] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentOrganizationId(),
  ]);

  if (userError) throw userError;
  if (!userData.user) {
    throw new Error('Sessao expirada. Entre novamente para cadastrar o lead.');
  }

  const { data: stage, error: stageError } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('key', 'new_lead')
    .eq('is_active', true)
    .single();

  if (stageError) throw stageError;

  const accountPayload: Partial<Account> = {
    organization_id: organizationId,
    lifecycle_status: 'lead',
    status: 'active',
    display_name: values.displayName,
    segment: values.segment,
    city: values.city,
    state: 'ES',
    lead_temperature: values.temperature,
    lead_source: values.source,
    owner_id: userData.user.id,
    created_by: userData.user.id,
  };

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert(accountPayload)
    .select('*')
    .single();

  if (accountError) throw accountError;

  const contactPayload: Partial<Contact> = {
    organization_id: organizationId,
    account_id: account.id,
    full_name: values.contactName,
    whatsapp: values.whatsapp || null,
    is_primary: true,
  };

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .insert(contactPayload)
    .select('*')
    .single();

  if (contactError) throw contactError;

  const opportunityPayload: Partial<Opportunity> = {
    organization_id: organizationId,
    account_id: account.id,
    primary_contact_id: contact.id,
    pipeline_stage_id: stage.id,
    title: values.opportunityTitle,
    estimated_value: values.estimatedValue,
    owner_id: userData.user.id,
  };

  const { data: opportunity, error: opportunityError } = await supabase
    .from('opportunities')
    .insert(opportunityPayload)
    .select('*')
    .single();

  if (opportunityError) throw opportunityError;

  return {
    account,
    contact,
    opportunity,
  } satisfies CommercialLead;
}

async function convertAccountIfWon(accountId: string, pipelineStageGroup: 'open' | 'won' | 'lost') {
  if (!supabase || pipelineStageGroup !== 'won') return;

  const { error } = await supabase
    .from('accounts')
    .update({ lifecycle_status: 'client', status: 'active' })
    .eq('id', accountId);

  if (error) throw error;
}

export async function updateOpportunityStage(values: UpdateOpportunityStageInput) {
  if (!supabase) {
    throw new Error('Supabase nao configurado.');
  }

  const now = new Date().toISOString();
  const patch: Partial<Opportunity> = {
    pipeline_stage_id: values.pipelineStageId,
  };

  if (values.pipelineStageGroup === 'won') {
    patch.won_at = now;
    patch.converted_at = now;
    patch.lost_at = null;
    patch.lost_reason = null;
  } else if (values.pipelineStageGroup === 'lost' && values.lostReason) {
    patch.lost_at = now;
    patch.lost_reason = values.lostReason;
    patch.won_at = null;
    patch.converted_at = null;
  }

  const { data, error } = await supabase
    .from('opportunities')
    .update(patch)
    .eq('id', values.opportunityId)
    .select('*')
    .single();

  if (error) throw error;

  await convertAccountIfWon(values.accountId, values.pipelineStageGroup);

  return data;
}

export async function updateOpportunityDetails(values: UpdateOpportunityDetailsInput) {
  if (!supabase) {
    throw new Error('Supabase nao configurado.');
  }

  const now = new Date().toISOString();
  const patch: Partial<Opportunity> = {
    title: values.title,
    estimated_value: values.estimatedValue,
    next_follow_up_at: values.nextFollowUpAt,
    pipeline_stage_id: values.pipelineStageId,
  };

  if (values.pipelineStageGroup === 'won') {
    patch.won_at = now;
    patch.converted_at = now;
    patch.lost_at = null;
    patch.lost_reason = null;
  }

  const { data, error } = await supabase
    .from('opportunities')
    .update(patch)
    .eq('id', values.opportunityId)
    .select('*')
    .single();

  if (error) throw error;

  await convertAccountIfWon(values.accountId, values.pipelineStageGroup);

  return data;
}

export async function convertOpportunityToClient(values: ConvertClientInput) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { error } = await supabase.rpc('rpc_convert_opportunity_to_client', {
    p_opportunity_id: values.opportunityId,
    p_services: values.services as Json,
  });

  if (error) throw error;
}

export async function fetchOpportunityLineItems(
  opportunityId: string,
): Promise<OpportunityLineItem[]> {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const { data, error } = await supabase
    .from('opportunity_line_items')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type CreateLineItemInput = {
  opportunityId: string;
  description: string;
  quantity: number;
  unitValue: number;
  recurrence: 'one_off' | 'monthly';
};

export async function createOpportunityLineItem(
  values: CreateLineItemInput,
): Promise<OpportunityLineItem> {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const { data, error } = await supabase
    .from('opportunity_line_items')
    .insert({
      opportunity_id: values.opportunityId,
      description: values.description,
      quantity: values.quantity,
      unit_value: values.unitValue,
      recurrence: values.recurrence,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOpportunityLineItem(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const { error } = await supabase.from('opportunity_line_items').delete().eq('id', id);
  if (error) throw error;
}
