'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { ExtractionInput } from '@/components/ExtractionInput';
import { InvoiceEditor } from '@/components/InvoiceEditor';
import { InvoicePrintView } from '@/components/InvoicePrintView';
import { Invoice } from '@/lib/types/invoice';

/** Creates a fresh blank invoice — always called client-side to avoid SSR/hydration mismatch with Math.random */
function createBlankInvoice(): Invoice {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  return {
    invoice_number: `INV-${dateStr}-${randomSuffix}`,
    customer_name: '',
    customer_phone: null,
    customer_email: null,
    customer_address: null,
    status: 'draft',
    currency: 'INR',
    items: [],
    subtotal: 0,
    gst_rate: 18,
    gst_amount: 0,
    discount: 0,
    total: 0,
    source_message: null,
    extraction_issues: [],
  };
}

export default function NewInvoicePage() {
  const router = useRouter();
  // useState initializer runs only on the client — safe for Math.random()
  const [invoice, setInvoice] = useState<Invoice>(createBlankInvoice);
  const [isLoadingExtract, setIsLoadingExtract] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleExtract = async (rawMessage: string) => {
    setIsLoadingExtract(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawMessage }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract invoice');
      }

      const ext = data.extractedData;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');

      setInvoice({
        invoice_number: `INV-${dateStr}-${randomSuffix}`,
        customer_name: ext.customer_name || 'Guest Customer',
        customer_phone: ext.customer_phone || null,
        customer_email: ext.customer_email || null,
        customer_address: ext.customer_address || null,
        status: 'pending',
        currency: ext.currency || 'INR',
        items: ext.items || [],
        subtotal: ext.subtotal || 0,
        gst_rate: ext.gst_rate || 0,
        gst_amount: ext.gst_amount || 0,
        discount: ext.discount || 0,
        total: ext.total || 0,
        notes: ext.notes || null,
        source_message: rawMessage,
        extraction_issues: ext.issues || [],
      });
    } catch (err: any) {
      alert(`Extraction Error: ${err.message}`);
    } finally {
      setIsLoadingExtract(false);
    }
  };

  const handleSave = async (invToSave: Invoice) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invToSave),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save');
      }
      router.push('/invoices');
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="border-b border-slate-200 pb-3 print:hidden">
          <h1 className="text-xl font-bold text-slate-900">Create New Invoice</h1>
          <p className="text-xs text-slate-500">
            Left: Extract customer message &bull; Right: Live editable preview
          </p>
        </div>

        {/* 2-Column Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 print:hidden">
            <ExtractionInput
              onExtract={handleExtract}
              isLoading={isLoadingExtract}
              initialMessage={invoice.source_message || ''}
            />
          </div>

          <div className="lg:col-span-8">
            <InvoiceEditor
              invoice={invoice}
              onChange={setInvoice}
              onSave={handleSave}
              isSaving={isSaving}
            />
          </div>
        </div>
      </main>

      <InvoicePrintView invoice={invoice} />
    </div>
  );
}
