import { supabase } from '@/integrations/supabase/client';
import type { ClientService, ServiceCatalog } from '@/types/database';

export const servicesQueryKey = ['services-catalog'] as const;

export async function fetchServiceCatalog(): Promise<ServiceCatalog[]> {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data, error } = await supabase.rpc('current_org_ids');
  if (error) throw error;

  const orgId = data.at(0);
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');

  const { data: catalog, error: catalogError } = await supabase
    .from('service_catalog')
    .select('*')
    .eq('organization_id', orgId)
    .order('name', { ascending: true });

  if (catalogError) throw catalogError;
  return catalog;
}

export type CreateServiceInput = {
  name: string;
  defaultPrice: number;
  recurrence: 'one_off' | 'monthly';
};

export async function createService(values: CreateServiceInput) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data: orgData, error: orgError } = await supabase.rpc('current_org_ids');
  if (orgError) throw orgError;

  const orgId = orgData?.at(0);
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');

  const { data, error } = await supabase
    .from('service_catalog')
    .insert({
      organization_id: orgId,
      name: values.name,
      default_price: values.defaultPrice,
      recurrence: values.recurrence,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getCurrentOrganizationId() {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const { data, error } = await supabase.rpc('current_org_ids');
  if (error) throw error;
  const orgId = data.at(0);
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  return orgId;
}

export async function fetchClientServices(accountId: string): Promise<ClientService[]> {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const { data, error } = await supabase
    .from('client_services')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addClientService(values: {
  accountId: string;
  serviceCatalogId: string;
  contractedPrice: number;
  recurrence: 'monthly' | 'one_off';
  billingDay: number | null;
}): Promise<ClientService> {
  if (!supabase) throw new Error('Supabase nao configurado.');
  const orgId = await getCurrentOrganizationId();
  const { data, error } = await supabase
    .from('client_services')
    .insert({
      organization_id: orgId,
      account_id: values.accountId,
      service_catalog_id: values.serviceCatalogId,
      contracted_price: values.contractedPrice,
      recurrence: values.recurrence,
      billing_day: values.billingDay,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
