'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setInfo('');

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      // email confirmation is set in Supabase dashboard — if disabled, user is
      // immediately confirmed and we can redirect right away.
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    // Supabase returns a session immediately when email confirm is disabled;
    // otherwise data.session is null and we show the check-email message.
    if (data.session) {
      // New user — no business profile yet → onboarding
      router.push('/onboarding');
      router.refresh();
    } else {
      setInfo('Check your email to confirm your account, then sign in.');
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg p-8 shadow-xs">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              W
            </div>
            <span className="font-bold text-slate-900">WhatsInvoice AI</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Create an account</h1>
          <p className="text-xs text-slate-500 mt-1">
            Start converting WhatsApp orders into professional invoices
          </p>
        </div>

        {/* Feedback */}
        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 p-3 rounded bg-blue-50 border border-blue-200 text-xs text-blue-800">
            {info}
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
              Password <span className="font-normal text-slate-400">(min 8 characters)</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
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
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
