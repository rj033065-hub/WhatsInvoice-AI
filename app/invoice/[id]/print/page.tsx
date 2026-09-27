'use client';

import React, { useState, useEffect, use } from 'react';
import { InvoicePrintView } from '@/components/InvoicePrintView';
import { Invoice } from '@/lib/types/invoice';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function DedicatedInvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/invoices/${id}`);
        const data = await res.json();
        if (res.ok && data.success && data.invoice) {
          setInvoice(data.invoice);
        } else {
          // Check local storage fallback
          const cached = localStorage.getItem('whatsinvoice_saved');
          if (cached) {
            const list: Invoice[] = JSON.parse(cached);
            const found = list.find((i) => i.id === id);
            if (found) {
              setInvoice(found);
              return;
            }
          }
          setError(data.error || 'Invoice not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load invoice');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-xs text-slate-500">Preparing invoice for print...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <p className="text-sm font-semibold text-rose-600 mb-4">{error || 'Invoice not found'}</p>
        <Link
          href={`/invoice/${id}`}
          className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Invoice Editor</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900 font-sans py-6 print:py-0">
      {/* ── Top Bar Controls (Hidden in Print) ─────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/invoice/${id}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded border border-slate-300 shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Editor</span>
        </Link>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* ── Printable Invoice Paper ────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto bg-white shadow-xs rounded-sm print:shadow-none print:rounded-none">
        <InvoicePrintView invoice={invoice} isAlwaysVisible={true} />
      </div>
    </div>
  );
}
