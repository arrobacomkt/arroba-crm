import { supabase } from '@/integrations/supabase/client';

import { readActiveWorkspaceId } from './workspace-storage';

export async function getCurrentWorkspaceId() {
  const preferredWorkspaceId = readActiveWorkspaceId();
  if (preferredWorkspaceId) return preferredWorkspaceId;

  if (!supabase) throw new Error('Supabase nao configurado.');
  const { data, error } = await supabase.rpc('current_org_ids');
  if (error) throw error;
  const orgId = data.at(0);
  if (!orgId) throw new Error('Usuario sem workspace ativo.');
  return orgId;
}
