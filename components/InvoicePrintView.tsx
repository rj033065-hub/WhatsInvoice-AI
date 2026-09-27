'use client';

import React, { useEffect, useState } from 'react';
import { Invoice, Business } from '@/lib/types/invoice';

interface InvoicePrintViewProps {
  invoice: Invoice;
  business?: Business | null;
  autoPrint?: boolean;
  isAlwaysVisible?: boolean;
}

export const InvoicePrintView: React.FC<InvoicePrintViewProps> = ({
  invoice,
  business: initialBusiness,
  autoPrint = false,
  isAlwaysVisible = false,
}) => {
  const [business, setBusiness] = useState<Business | null>(initialBusiness || null);

  useEffect(() => {
    if (!business) {
      const cached = localStorage.getItem('wi_profile');
      if (cached) {
        try {
          setBusiness(JSON.parse(cached));
        } catch {}
      } else {
        fetch('/api/business')
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.business) {
              setBusiness(data.business);
            }
          })
          .catch(() => {});
      }
    }
  }, [business]);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const currency = invoice.currency || '₹';
  const issueDate = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

  const businessName = business?.business_name || 'WhatsInvoice Store';

  return (
    <div
      className={`invoice-print-container bg-white text-slate-900 font-sans p-6 max-w-4xl mx-auto ${
        isAlwaysVisible ? 'block' : 'hidden print:block'
      }`}
    >
      {/* ── Top Header: Business Branding & Invoice Metadata ───────────── */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
        <div>
          {business?.logo_url && (
            <img
              src={business.logo_url}
              alt={businessName}
              className="h-12 w-auto object-contain mb-2"
            />
          )}
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
            {businessName}
          </h1>
          {business?.business_type && (
            <p className="text-xs text-slate-500 font-medium">{business.business_type}</p>
          )}

          {/* Business Contact & Address */}
          <div className="text-xs text-slate-600 mt-1.5 space-y-0.5">
            {business?.address && <p>{business.address}</p>}
            {(business?.city || business?.state || business?.pincode) && (
              <p>
                {[business.city, business.state, business.pincode].filter(Boolean).join(', ')}
              </p>
            )}
            {business?.phone && <p>Phone: {business.phone}</p>}
            {business?.email && <p>Email: {business.email}</p>}
            {business?.gstin && (
              <p className="font-mono font-bold text-slate-900 mt-1">
                GSTIN: {business.gstin}
              </p>
            )}
          </div>
        </div>

        {/* Invoice Title & Number */}
        <div className="text-right">
          <span className="inline-block px-2.5 py-1 text-xs font-black uppercase tracking-wider bg-slate-900 text-white rounded-xs mb-2">
            TAX INVOICE
          </span>
          <p className="text-base font-bold font-mono text-slate-900">
            {invoice.invoice_number}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">Date: {issueDate}</p>
          <div className="mt-2 text-xs font-semibold uppercase tracking-wider">
            Status: <span className="underline">{invoice.status}</span>
          </div>
        </div>
      </div>

      {/* ── Customer & Billing Details ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-8 mb-6 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Billed To:
          </h3>
          <p className="text-sm font-bold text-slate-900">{invoice.customer_name}</p>
          {invoice.customer_phone && (
            <p className="text-xs text-slate-600 mt-0.5">Phone: {invoice.customer_phone}</p>
          )}
          {invoice.customer_email && (
            <p className="text-xs text-slate-600 mt-0.5">Email: {invoice.customer_email}</p>
          )}
          {invoice.customer_address && (
            <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">
              Address: {invoice.customer_address}
            </p>
          )}
        </div>

        <div className="text-right">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Payment & Summary:
          </h3>
          <p className="text-xs text-slate-600">Currency: {currency}</p>
          <p className="text-xs text-slate-600">Total Items: {invoice.items.length}</p>
        </div>
      </div>

      {/* ── Line Items Table ─────────────────────────────────────────────── */}
      <table className="w-full text-left text-xs border-collapse mb-6">
        <thead>
          <tr className="border-y-2 border-slate-900 uppercase font-bold text-slate-900">
            <th className="py-2.5 pr-2 w-8 text-center">#</th>
            <th className="py-2.5 px-3">Item / Service Description</th>
            <th className="py-2.5 px-3 w-20 text-center">Qty</th>
            <th className="py-2.5 px-3 w-28 text-right">Unit Price</th>
            <th className="py-2.5 pl-3 w-28 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {invoice.items.map((item, idx) => (
            <tr key={idx} className="break-inside-avoid">
              <td className="py-2.5 pr-2 text-center text-slate-500 font-mono">{idx + 1}</td>
              <td className="py-2.5 px-3 font-semibold text-slate-900">{item.product_name}</td>
              <td className="py-2.5 px-3 text-center font-mono">{item.quantity}</td>
              <td className="py-2.5 px-3 text-right font-mono">
                {currency} {item.unit_price.toFixed(2)}
              </td>
              <td className="py-2.5 pl-3 text-right font-mono font-bold text-slate-900">
                {currency} {item.amount.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Financial Totals Breakdown ───────────────────────────────────── */}
      <div className="flex justify-end mb-6">
        <div className="w-72 space-y-2 text-xs border-t-2 border-slate-900 pt-3">
          <div className="flex justify-between text-slate-700">
            <span>Subtotal:</span>
            <span className="font-mono font-semibold">
              {currency} {invoice.subtotal.toFixed(2)}
            </span>
          </div>

          {invoice.discount > 0 && (
            <div className="flex justify-between text-slate-700">
              <span>Discount:</span>
              <span className="font-mono text-rose-600">
                - {currency} {invoice.discount.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between text-slate-700">
            <span>GST ({invoice.gst_rate}%):</span>
            <span className="font-mono">
              + {currency} {invoice.gst_amount.toFixed(2)}
            </span>
          </div>

          <div className="border-t-2 border-slate-900 pt-2 flex justify-between font-extrabold text-sm text-slate-900">
            <span>Final Total:</span>
            <span className="font-mono text-base">
              {currency} {invoice.total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Notes / Terms ────────────────────────────────────────────────── */}
      {invoice.notes && (
        <div className="border-t border-slate-200 pt-3 mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            Notes / Payment Terms:
          </h4>
          <p className="text-xs text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="border-t border-slate-200 pt-4 text-center text-[11px] text-slate-500 space-y-1">
        <p className="font-medium">Thank you for your business!</p>
        <p className="text-[10px] text-slate-400">
          Created with WhatsInvoice AI • Verified Exact Arithmetic
        </p>
      </div>
    </div>
  );
};
