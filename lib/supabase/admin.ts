import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase admin client using SUPABASE_SERVICE_ROLE_KEY.
 * NEVER import or use this client in browser/client components.
 * Only use for system administration tasks or user profile metadata updates.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
