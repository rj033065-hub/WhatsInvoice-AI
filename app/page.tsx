'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { ExtractionInput } from '@/components/ExtractionInput';
import { InvoiceEditor } from '@/components/InvoiceEditor';
import { InvoicePrintView } from '@/components/InvoicePrintView';
import { InvoiceList } from '@/components/InvoiceList';
import { AuthModal } from '@/components/AuthModal';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { Invoice } from '@/lib/types/invoice';
import { createClient } from '@/lib/supabase/client';
import { FileText, Plus, LayoutDashboard, History, Check } from 'lucide-react';

function createInitialInvoice(): Invoice {
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

export default function Home() {
  const [activeView, setActiveView] = useState<'create' | 'history'>('create');
  // useState initializer runs only on client — safe for Math.random()
  const [currentInvoice, setCurrentInvoice] = useState<Invoice>(createInitialInvoice);
  const [savedInvoices, setSavedInvoices] = useState<Invoice[]>([]);
  const [isLoadingExtract, setIsLoadingExtract] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    try {
      const cached = localStorage.getItem('whatsinvoice_saved');
      if (cached) {
        setSavedInvoices(JSON.parse(cached));
      }
    } catch {}

    fetchSavedInvoices();

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const fetchSavedInvoices = async () => {
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      if (data.success && Array.isArray(data.invoices) && data.invoices.length > 0) {
        setSavedInvoices(data.invoices);
        localStorage.setItem('whatsinvoice_saved', JSON.stringify(data.invoices));
      }
    } catch (err) {
      console.warn('Fetch saved invoices warning:', err);
    }
  };

  const handleExtract = async (rawMessage: string) => {
    setIsLoadingExtract(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawMessage, customApiKey }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract invoice data');
      }

      const ext = data.extractedData;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');

      const newInvoice: Invoice = {
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
      };

      setCurrentInvoice(newInvoice);
      setActiveView('create');
    } catch (err: any) {
      alert(`Extraction Error: ${err.message}`);
    } finally {
      setIsLoadingExtract(false);
    }
  };

  const handleSaveInvoice = async (invoiceToSave: Invoice) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceToSave),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save invoice');
      }

      const savedObj = data.invoice;
      setCurrentInvoice(savedObj);

      setSavedInvoices((prev) => {
        const filtered = prev.filter(
          (i) => i.id !== savedObj.id && i.invoice_number !== savedObj.invoice_number
        );
        const updatedList = [savedObj, ...filtered];
        localStorage.setItem('whatsinvoice_saved', JSON.stringify(updatedList));
        return updatedList;
      });
    } catch (err: any) {
      alert(`Save Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      if (!id.startsWith('local-')) {
        await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      }
      setSavedInvoices((prev) => {
        const updated = prev.filter((i) => i.id !== id);
        localStorage.setItem('whatsinvoice_saved', JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <Navbar
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenApiKey={() => setIsApiKeyOpen(true)}
        onSignOut={handleSignOut}
        hasCustomApiKey={!!customApiKey}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Workspace Sub-header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 print:hidden">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Invoice Workspace & Extraction
            </h1>
            <p className="text-xs text-slate-500">
              Turn raw WhatsApp order messages into verified financial invoices with Decimal.js precision
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('create')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                activeView === 'create'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create / Edit Invoice</span>
            </button>

            <button
              onClick={() => setActiveView('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                activeView === 'history'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Saved Database Invoices ({savedInvoices.length})</span>
            </button>
          </div>
        </div>

        {/* View 1: 2-Column Split Workspace (Left: Input & Extract, Right: Live Editable Preview) */}
        {activeView === 'create' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Customer Message Input & Extract Button */}
            <div className="lg:col-span-4 space-y-4 print:hidden">
              <ExtractionInput
                onExtract={handleExtract}
                isLoading={isLoadingExtract}
                initialMessage={currentInvoice.source_message || ''}
              />
            </div>

            {/* Right Column: Live Editable Invoice Preview */}
            <div className="lg:col-span-8">
              <InvoiceEditor
                invoice={currentInvoice}
                onChange={setCurrentInvoice}
                onSave={handleSaveInvoice}
                isSaving={isSaving}
              />
            </div>
          </div>
        ) : (
          /* View 2: Saved Invoices Database Grid */
          <InvoiceList
            invoices={savedInvoices}
            onSelectInvoice={(inv) => {
              setCurrentInvoice(inv);
              setActiveView('create');
            }}
            onDeleteInvoice={handleDeleteInvoice}
          />
        )}
      </main>

      {/* Printable Invoice Sheet */}
      <InvoicePrintView invoice={currentInvoice} />

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8 text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>WhatsInvoice AI &bull; Business Productivity Software</span>
          <span>Next.js App Router &bull; Supabase RLS &bull; Decimal.js Exact Calculations</span>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          fetchSavedInvoices();
        }}
      />

      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        apiKey={customApiKey}
        onSaveKey={setCustomApiKey}
      />
    </div>
  );
}
