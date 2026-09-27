import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Server-side Supabase client for Route Handlers and Server Components.
 * Reads/writes session cookies via next/headers.
 * Uses the publishable (anon) key — Supabase RLS enforces row-level access.
 * Never use this with the service-role key.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll is called from a Server Component — cookies cannot be
          // mutated there, but the session remains valid via the middleware.
        }
      },
    },
  });
}
