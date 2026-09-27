'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if we arrived from a failed auth callback
  const callbackError = searchParams.get('error');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      if (!supabaseUrl || supabaseUrl.includes('your-supabase-project') || supabaseUrl.includes('placeholder')) {
        setError(
          'Supabase is not configured yet. Please set your real NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.'
        );
        setIsLoading(false);
        return;
      }

      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      const hasProfile = !!(data.user?.user_metadata?.onboarded);
      router.push(hasProfile ? redirectTo : '/onboarding');
      router.refresh();
    } catch (err: any) {
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        setError(
          'Failed to connect to Supabase. Please verify that NEXT_PUBLIC_SUPABASE_URL in your .env.local is an active, valid Supabase project URL.'
        );
      } else {
        setError(err?.message || 'An unexpected error occurred during sign in.');
      }
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg p-8 shadow-xs">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            W
          </div>
          <span className="font-bold text-slate-900">WhatsInvoice AI</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Sign in to your account</h1>
        <p className="text-xs text-slate-500 mt-1">
          Access your invoices and customer records
        </p>
      </div>

      {/* Error */}
      {(error || callbackError) && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700">
          {error || 'Email confirmation failed. Please try signing in again.'}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none bg-white"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-blue-600 font-semibold hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      {/* Suspense boundary required because LoginForm uses useSearchParams() */}
      <Suspense fallback={<div className="text-xs text-slate-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
