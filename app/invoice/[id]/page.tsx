'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { InvoiceEditor } from '@/components/InvoiceEditor';
import { InvoicePrintView } from '@/components/InvoicePrintView';
import { Invoice } from '@/lib/types/invoice';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${id}`);
      const data = await res.json();
      if (res.ok && data.success && data.invoice) {
        setInvoice(data.invoice);
      } else {
        // Fallback to local storage if local ID
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
  };

  const handleSave = async (updated: Invoice) => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      if (id.startsWith('local-')) {
        // Local update
        const cached = localStorage.getItem('whatsinvoice_saved');
        if (cached) {
          const list: Invoice[] = JSON.parse(cached);
          const updatedList = list.map((i) => (i.id === id ? updated : i));
          localStorage.setItem('whatsinvoice_saved', JSON.stringify(updatedList));
        }
        setInvoice(updated);
        setSaveMessage({ type: 'success', text: 'Invoice updated locally.' });
      } else {
        const res = await fetch(`/api/invoices/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to update invoice');
        }
        // Update state with server-recalculated invoice data
        setInvoice(data.invoice);
        setSaveMessage({ type: 'success', text: 'Invoice updated successfully on server!' });
      }
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Error saving invoice' });
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    setIsDeleting(true);
    try {
      if (invoiceId.startsWith('local-')) {
        const cached = localStorage.getItem('whatsinvoice_saved');
        if (cached) {
          const list: Invoice[] = JSON.parse(cached);
          const filtered = list.filter((i) => i.id !== invoiceId);
          localStorage.setItem('whatsinvoice_saved', JSON.stringify(filtered));
        }
      } else {
        const res = await fetch(`/api/invoices/${invoiceId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete invoice');
        }
      }
      router.push('/invoices');
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-xs text-slate-500 font-medium">Loading invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border border-slate-200 p-6 rounded-lg max-w-md w-full text-center space-y-3 shadow-xs">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-sm font-bold text-slate-900">Invoice Unavailable</h2>
          <p className="text-xs text-slate-500">{error || 'This invoice does not exist or you do not have permission to view it.'}</p>
          <div className="pt-2">
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Invoices</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar
        user={null}
        onOpenAuth={() => {}}
        onOpenApiKey={() => {}}
        onSignOut={() => {}}
        hasCustomApiKey={false}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/invoices"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Invoices History</span>
          </Link>

          {saveMessage && (
            <div
              className={`text-xs font-semibold px-3 py-1 rounded border ${
                saveMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {saveMessage.text}
            </div>
          )}
        </div>

        <InvoiceEditor
          invoice={invoice}
          onChange={setInvoice}
          onSave={handleSave}
          onDelete={handleDelete}
          isSaving={isSaving}
          isDeleting={isDeleting}
        />
      </main>

      <InvoicePrintView invoice={invoice} />
    </div>
  );
}
