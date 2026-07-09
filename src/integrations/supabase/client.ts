import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

export type SupabaseMode = 'configured' | 'local-placeholder';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseMode: SupabaseMode =
  supabaseUrl && supabaseAnonKey ? 'configured' : 'local-placeholder';

export const supabase: SupabaseClient<Database> | null =
  supabaseMode === 'configured' ? createClient(supabaseUrl, supabaseAnonKey) : null;
