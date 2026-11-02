'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { FileText, Plus, LayoutDashboard, Settings, LogOut, Key } from 'lucide-react';

interface NavbarProps {
  user?: User | null;
  onOpenAuth?: () => void;
  onOpenApiKey?: () => void;
  onSignOut?: () => void;
  hasCustomApiKey?: boolean;
}

const NAV_LINKS = [
  { label: 'Dashboard', href: '#dashboard', id: 'dashboard', icon: LayoutDashboard },
  { label: 'New Invoice', href: '#new-invoice', id: 'new-invoice', icon: Plus },
  { label: 'Invoices', href: '#invoices', id: 'invoices', icon: FileText },
  { label: 'Settings', href: '#settings', id: 'settings', icon: Settings },
];

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuth,
  onOpenApiKey,
  hasCustomApiKey,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState<string>('dashboard');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Scroll spy to highlight active section in Navbar
  useEffect(() => {
    if (pathname !== '/') return;

    const sectionIds = ['dashboard', 'new-invoice', 'invoices', 'settings'];
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;

      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push('/login');
    router.refresh();
  }

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, id: string) => {
    if (pathname === '/') {
      e.preventDefault();
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.pushState(null, '', href);
        setActiveSection(id);
      }
    } else {
      router.push('/' + href);
    }
  };

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-30 print:hidden transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand + Navigation */}
        <div className="flex items-center gap-6">
          <Link
            href="/#dashboard"
            onClick={(e) => handleNavClick(e, '#dashboard', 'dashboard')}
            className="flex items-center gap-2 shrink-0 group"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm select-none shadow-xs group-hover:bg-emerald-500 transition-colors">
              W
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">
              WhatsInvoice{' '}
              <span className="ml-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded align-middle">
                AI
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href, id, icon: Icon }) => {
              const isActive = pathname === '/' ? activeSection === id : pathname === href;
              return (
                <a
                  key={href}
                  href={pathname === '/' ? href : '/' + href}
                  onClick={(e) => handleNavClick(e, href, id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onOpenApiKey && (
            <button
              onClick={onOpenApiKey}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                hasCustomApiKey
                  ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Configure API key"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">API Key</span>
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-xs text-slate-500 truncate max-w-[160px]">
                {user.user_metadata?.business_name || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-xs"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
