'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { InvoiceList } from '@/components/InvoiceList';
import { Invoice } from '@/lib/types/invoice';
import { createClient } from '@/lib/supabase/client';
import { FileText, Plus } from 'lucide-react';
import { SonarGrid } from '@/components/ui/sonar-grid';

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
    });

    try {
      const cached = localStorage.getItem('whatsinvoice_saved');
      if (cached) {
        setInvoices(JSON.parse(cached));
      }
    } catch {}

    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      if (data.success && Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
        localStorage.setItem('whatsinvoice_saved', JSON.stringify(data.invoices));
      }
    } catch (err) {
      console.warn('Dashboard fetch warning:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      if (!id.startsWith('local-')) {
        await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      }
      setInvoices((prev) => {
        const updated = prev.filter((i) => i.id !== id);
        localStorage.setItem('whatsinvoice_saved', JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar
        user={user}
        onOpenAuth={() => {}}
        onOpenApiKey={() => {}}
        onSignOut={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          setUser(null);
        }}
        hasCustomApiKey={false}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <SonarGrid
          spacing={28}
          dotRadius={1.2}
          baseOpacity={0.16}
          pingEvery={3.5}
          speed={220}
          ringWidth={70}
          amplitude={1.4}
          interactive
          maxRings={3}
          seedPing
          pingArea={[0.15, 0.18, 0.85, 0.82]}
          className="min-h-[320px] rounded-xl border border-blue-100 bg-white shadow-sm sm:min-h-[340px]"
        >
          <div className="flex min-h-[320px] flex-col items-center justify-center px-5 py-10 text-center sm:min-h-[340px] sm:px-10">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
              WhatsInvoice AI Workspace
            </p>
            <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              AI Invoice Workspace
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Turn customer messages into accurate, professional invoices with AI-powered extraction.
            </p>
            <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <Link
                href="/invoice/new"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Invoice
              </Link>
              <Link
                href="/invoices"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                View Invoices
              </Link>
            </div>
            <p className="mt-6 text-[11px] text-slate-500">
              Protected by Supabase Row Level Security (RLS) &bull; Decimal.js Exact Calculations
            </p>
          </div>
        </SonarGrid>

        <InvoiceList
          invoices={invoices}
          onSelectInvoice={(inv) => {
            if (inv.id) {
              window.location.href = `/invoice/${inv.id}`;
            } else {
              window.location.href = '/';
            }
          }}
          onDeleteInvoice={handleDelete}
        />
      </main>
    </div>
  );
}
