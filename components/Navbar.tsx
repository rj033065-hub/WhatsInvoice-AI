'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { FileText, Plus, LayoutDashboard, Settings, LogOut } from 'lucide-react';

// Optional props kept for compatibility with pages that pass them in.
// When omitted the Navbar manages its own auth state.
interface NavbarProps {
  user?: User | null;
  onOpenAuth?: () => void;
  onOpenApiKey?: () => void;
  onSignOut?: () => void;
  hasCustomApiKey?: boolean;
}

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Invoices', href: '/invoices', icon: FileText },
  { label: 'New Invoice', href: '/invoice/new', icon: Plus },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, onOpenApiKey, hasCustomApiKey }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // Initialise from current session
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    // Keep in sync across tabs / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-30 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand + Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm select-none">
              W
            </div>
            <span className="font-bold text-slate-900 text-sm">
              WhatsInvoice{' '}
              <span className="ml-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded align-middle">
                AI
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    active
                      ? 'bg-slate-100 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden sm:block text-xs text-slate-500 truncate max-w-[180px]">
                {user.user_metadata?.business_name || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
