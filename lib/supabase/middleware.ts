import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

// Routes that require a logged-in user
const PROTECTED = ['/dashboard', '/invoices', '/invoice', '/settings', '/onboarding'];
// Routes that logged-in users should not revisit
const AUTH_ROUTES = ['/login', '/signup'];

/**
 * Refreshes the Supabase session token on every request and enforces
 * redirect rules for protected vs. auth-only routes.
 *
 * Rules (in priority order):
 *  1. Unauthenticated → protected route  →  /login?redirectTo=<original>
 *  2. Authenticated → /login or /signup  →  /dashboard (or /onboarding if no profile)
 *  3. Authenticated + no business profile → /onboarding (except from /onboarding itself)
 */
export async function updateSession(request: NextRequest) {
  // Start with a plain next() response so we can attach updated cookies
  let supabaseResponse = NextResponse.next({ request });

  // Guard: env vars not yet wired — skip silently so the app still renders
  if (!supabaseUrl || !supabaseKey ||
    supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Mirror cookies on the request first (for downstream reads)
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // Re-create the response with the updated request so Next.js sees the changes
        supabaseResponse = NextResponse.next({ request });
        // Write the cookies onto the response (this is what the browser persists)
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: always call getUser() — do NOT call getSession() here.
  // getUser() validates the JWT with Supabase servers; getSession() only
  // reads the local cookie and can be spoofed.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // ── Rule 1: no user, protected route → /login ────────────────────────────
  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Rule 2: user already signed in, visiting /login or /signup ───────────
  if (user && isAuthRoute) {
    const hasProfile = !!(user.user_metadata?.onboarded);
    const dest = request.nextUrl.clone();
    dest.pathname = hasProfile ? '/dashboard' : '/onboarding';
    dest.search = '';
    return NextResponse.redirect(dest);
  }

  // ── Rule 3: user exists but business profile not yet set ─────────────────
  if (user && isProtected && pathname !== '/onboarding') {
    const hasProfile = !!(user.user_metadata?.onboarded);
    // Also honour a lightweight cookie so we don't redirect on every request
    // when Supabase metadata propagation is slightly delayed
    const cookieFlag = request.cookies.get('wi_onboarded')?.value;
    if (!hasProfile && !cookieFlag) {
      const dest = request.nextUrl.clone();
      dest.pathname = '/onboarding';
      dest.search = '';
      return NextResponse.redirect(dest);
    }
  }

  return supabaseResponse;
}
