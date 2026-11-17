import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Public catalogue reads only. Visitors do not get anonymous Auth accounts. */
export function createPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Configure the dedicated HUT project before database access.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
