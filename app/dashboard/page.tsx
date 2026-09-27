'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { InvoiceList } from '@/components/InvoiceList';
import { Invoice } from '@/lib/types/invoice';
import { createClient } from '@/lib/supabase/client';
import { Plus, Sparkles, FileText, History, TrendingUp, DollarSign } from 'lucide-react';

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Seller Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Protected by Supabase Row Level Security (RLS) &bull; Decimal.js Exact Calculations
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/invoice/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create / Extract Invoice</span>
            </Link>
          </div>
        </div>

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
