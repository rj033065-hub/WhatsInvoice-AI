'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ExtractionInput } from '@/components/ExtractionInput';
import { InvoiceEditor } from '@/components/InvoiceEditor';
import { InvoicePrintView } from '@/components/InvoicePrintView';
import { InvoiceList } from '@/components/InvoiceList';
import { SettingsSection } from '@/components/SettingsSection';
import { AuthModal } from '@/components/AuthModal';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { Invoice } from '@/lib/types/invoice';
import { createClient } from '@/lib/supabase/client';
import {
  FileText,
  Plus,
  LayoutDashboard,
  Settings,
  Sparkles,
  CheckCircle2,
  Clock,
  TrendingUp,
  Receipt,
} from 'lucide-react';
import { SonarGrid } from '@/components/ui/sonar-grid';
import { SpectralRibbon } from '@/components/ui/spectral-ribbon';

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
  const [currentInvoice, setCurrentInvoice] = useState<Invoice>(createInitialInvoice);
  const [savedInvoices, setSavedInvoices] = useState<Invoice[]>([]);
  const [isLoadingExtract, setIsLoadingExtract] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
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
        setIsLoadingInvoices(false);
      }
      const key = localStorage.getItem('whatsinvoice_llm_key') || '';
      setCustomApiKey(key);
    } catch {}

    fetchSavedInvoices();

    // Check if URL has hash (e.g. #new-invoice) on first mount
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      setTimeout(() => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const fetchSavedInvoices = async () => {
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      if (data.success && Array.isArray(data.invoices)) {
        setSavedInvoices(data.invoices);
        localStorage.setItem('whatsinvoice_saved', JSON.stringify(data.invoices));
      }
    } catch (err) {
      console.warn('Fetch saved invoices warning:', err);
    } finally {
      setIsLoadingInvoices(false);
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

      if (data.invoice) {
        setCurrentInvoice((prev) => ({
          ...prev,
          ...data.invoice,
          source_message: rawMessage,
          items: data.invoice.items || prev.items,
        }));
      }
    } catch (err: any) {
      alert(`Extraction failed: ${err.message}`);
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

      const savedInv = data.invoice || invoiceToSave;
      setSavedInvoices((prev) => {
        const index = prev.findIndex((i) => i.id === savedInv.id || i.invoice_number === savedInv.invoice_number);
        const next = index >= 0 ? prev.map((item, idx) => (idx === index ? savedInv : item)) : [savedInv, ...prev];
        localStorage.setItem('whatsinvoice_saved', JSON.stringify(next));
        return next;
      });

      alert('Invoice successfully saved to database!');
    } catch (err: any) {
      // Offline fallback
      const localId = invoiceToSave.id || `local-${Date.now()}`;
      const localInvoice = { ...invoiceToSave, id: localId };
      setSavedInvoices((prev) => {
        const next = [localInvoice, ...prev.filter((i) => i.id !== localId)];
        localStorage.setItem('whatsinvoice_saved', JSON.stringify(next));
        return next;
      });
      alert(`Saved locally (Offline/Demo mode): ${err.message}`);
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
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState(null, '', `#${id}`);
    }
  };

  // Metrics for Dashboard
  const totalBilled = savedInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
  const paidCount = savedInvoices.filter((i) => i.status === 'paid').length;
  const draftCount = savedInvoices.filter((i) => i.status === 'draft').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 relative">
      {/* Ambient WhatsApp Green Spectral Ribbon in the background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen opacity-35 print:hidden">
        <SpectralRibbon
          palette="green"
          speed={0.6}
          intensity={1.25}
          thickness={1.1}
          grain={0.3}
          className="w-full h-full !bg-black"
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <Navbar
          user={user}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenApiKey={() => setIsApiKeyOpen(true)}
          onSignOut={handleSignOut}
          hasCustomApiKey={!!customApiKey}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
          {/* ========================================================
              SECTION 1: DASHBOARD (#dashboard)
             ======================================================== */}
          <section id="dashboard" className="scroll-mt-20 space-y-6">
            <SonarGrid
              spacing={28}
              dotRadius={1.2}
              baseOpacity={0.12}
              pingEvery={3.5}
              speed={220}
              ringWidth={70}
              amplitude={1.4}
              interactive
              maxRings={3}
              seedPing
              pingArea={[0.15, 0.18, 0.85, 0.82]}
              className="motion-card min-h-[300px] rounded-2xl border border-slate-200 bg-white text-emerald-400 p-6 sm:p-10 relative overflow-hidden shadow-xs"
            >
              <div className="flex flex-col items-center justify-center text-center max-w-3xl mx-auto space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>WhatsApp AI Accounting &amp; Precision Billing</span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
                  One-Stop Invoice Workspace
                </h1>

                <p className="text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
                  Extract order messages instantly, generate GST-compliant invoices with Decimal.js exact precision, and manage your business all in one smooth view.
                </p>

                {/* Quick Action Navigation */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => scrollToSection('new-invoice')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Invoice</span>
                  </button>

                  <button
                    onClick={() => scrollToSection('invoices')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-2 border border-slate-200 hover:border-emerald-500 text-slate-700 text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Browse Invoices ({savedInvoices.length})</span>
                  </button>

                  <button
                    onClick={() => scrollToSection('settings')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-2 border border-slate-200 hover:border-emerald-500 text-slate-700 text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Store Settings</span>
                  </button>
                </div>
              </div>

              {/* Live KPI Metric Badges */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-200">
                <div className="p-3.5 rounded-xl bg-surface-2 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Total Invoices</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">{savedInvoices.length}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-2 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Total Revenue</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    ₹{totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-2 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Paid Invoices</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">{paidCount}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-2 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Draft / Pending</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">{draftCount}</div>
                </div>
              </div>
            </SonarGrid>
          </section>

          {/* ========================================================
              SECTION 2: NEW INVOICE WORKSPACE (#new-invoice)
             ======================================================== */}
          <section id="new-invoice" className="scroll-mt-20 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 print:hidden">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Interactive Workspace</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Create &amp; Extract New Invoice
                </h2>
                <p className="text-xs text-slate-500">
                  Paste raw WhatsApp order messages on the left or edit line items directly on the right
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCurrentInvoice(createInitialInvoice())}
                className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:border-emerald-500 text-xs font-semibold text-slate-700 bg-white transition-colors cursor-pointer"
              >
                <span>Reset to Blank Sheet</span>
              </button>
            </div>

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
          </section>

          {/* ========================================================
              SECTION 3: INVOICES MANAGEMENT (#invoices)
             ======================================================== */}
          <section id="invoices" className="scroll-mt-20 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Database Records</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Saved Invoices Management
                </h2>
                <p className="text-xs text-slate-500">
                  Search, filter, view details, print, or load any invoice back into the editor
                </p>
              </div>

              <button
                onClick={() => scrollToSection('new-invoice')}
                className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Invoice</span>
              </button>
            </div>

            <InvoiceList
              invoices={savedInvoices}
              isLoading={isLoadingInvoices}
              onSelectInvoice={(inv) => {
                setCurrentInvoice(inv);
                scrollToSection('new-invoice');
              }}
              onDeleteInvoice={handleDeleteInvoice}
            />
          </section>

          {/* ========================================================
              SECTION 4: SETTINGS & BUSINESS PROFILE (#settings)
             ======================================================== */}
          <SettingsSection onApiKeySaved={(key) => setCustomApiKey(key)} />
        </main>

        {/* Printable Invoice Sheet */}
        <InvoicePrintView invoice={currentInvoice} />

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-6 mt-16 text-xs text-slate-500 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                W
              </div>
              <span className="font-semibold text-slate-700">WhatsInvoice AI &bull; All-in-One Business Billing</span>
            </div>
            <span>Next.js App Router &bull; Supabase RLS &bull; Decimal.js Exact Math</span>
          </div>
        </footer>
      </div>

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
