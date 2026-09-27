import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Supabase Auth callback — exchanges a one-time code for a session.
 * Supabase sends users here after email confirmation.
 * The `next` param is the post-auth destination; defaults to /dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const hasProfile = !!(data.user.user_metadata?.onboarded);
      const destination = hasProfile ? next : '/onboarding';
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // Code missing or exchange failed → send to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
