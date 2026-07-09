import { supabase } from '@/integrations/supabase/client';

export type DashboardFinancials = {
  mrr: number;
  pendingInvoices: number;
  lateInvoices: number;
};

export const dashboardFinancialsKey = ['dashboard-financials'] as const;

export async function fetchDashboardFinancials(): Promise<DashboardFinancials> {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data: orgData, error: orgError } = await supabase.rpc('current_org_ids');
  if (orgError) throw orgError;

  const orgId = orgData?.at(0);
  if (!orgId) return { mrr: 0, pendingInvoices: 0, lateInvoices: 0 };

  const [servicesResult, billingResult] = await Promise.all([
    supabase
      .from('client_services')
      .select('contracted_price')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .eq('recurrence', 'monthly'),
    supabase
      .from('billing_cycles')
      .select('status')
      .eq('organization_id', orgId)
      .in('status', ['pending', 'late']),
  ]);

  const mrr = (servicesResult.data ?? []).reduce(
    (acc, curr) => acc + Number(curr.contracted_price),
    0,
  );

  const pendingInvoices = (billingResult.data ?? []).filter((b) => b.status === 'pending').length;
  const lateInvoices = (billingResult.data ?? []).filter((b) => b.status === 'late').length;

  return { mrr, pendingInvoices, lateInvoices };
}
