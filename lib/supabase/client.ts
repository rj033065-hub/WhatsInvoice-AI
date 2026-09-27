import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

/**
 * Browser-side Supabase client.
 * Uses the publishable (anon) key — safe for the browser.
 * Session cookies are managed by @supabase/ssr automatically.
 * Never import the service-role key here.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
