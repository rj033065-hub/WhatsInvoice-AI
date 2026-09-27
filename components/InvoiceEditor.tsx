'use client';

import React, { useState } from 'react';
import { Invoice, InvoiceItem } from '@/lib/types/invoice';
import { calculateInvoiceTotals, validateCalculationInput } from '@/lib/calculations';
import { generateWhatsAppShareUrl } from '@/lib/whatsapp';
import { IssueBadges } from './IssueBadges';
import { Plus, Trash2, Save, Printer, Share2, Check, AlertCircle, AlertTriangle } from 'lucide-react';

interface InvoiceEditorProps {
  invoice: Invoice;
  onChange: (updated: Invoice) => void;
  onSave: (invoiceToSave: Invoice) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isSaving: boolean;
  isDeleting?: boolean;
}

/** Recalculate all derived totals and return an updated Invoice with live exact arithmetic */
function recalc(inv: Invoice): Invoice {
  const c = calculateInvoiceTotals({
    items: inv.items,
    gst_rate: inv.gst_rate,
    discount: inv.discount,
  });
  return {
    ...inv,
    items: c.items,
    subtotal: c.subtotal,
    gst_rate: c.gst_rate,
    gst_amount: c.gst_amount,
    discount: c.discount,
    total: c.total,
  };
}

export const InvoiceEditor: React.FC<InvoiceEditorProps> = ({
  invoice,
  onChange,
  onSave,
  onDelete,
  isSaving,
  isDeleting = false,
}) => {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errors: string[] = [];

    if (!invoice.customer_name || !invoice.customer_name.trim()) {
      errors.push('Customer Name is required.');
    }

    if (!invoice.items || invoice.items.length === 0) {
      errors.push('At least one item is required on the invoice.');
    } else {
      invoice.items.forEach((item, idx) => {
        const label = item.product_name || `Item #${idx + 1}`;
        if (!item.product_name || !item.product_name.trim()) {
          errors.push(`Item #${idx + 1} name cannot be empty.`);
        }
        if (item.quantity <= 0 || isNaN(item.quantity)) {
          errors.push(`"${label}": Quantity must be greater than 0.`);
        }
        if (item.unit_price < 0 || isNaN(item.unit_price)) {
          errors.push(`"${label}": Unit price cannot be negative.`);
        }
      });
    }

    if (invoice.gst_rate < 0 || isNaN(invoice.gst_rate)) {
      errors.push('GST Rate cannot be negative.');
    }

    if (invoice.discount < 0 || isNaN(invoice.discount)) {
      errors.push('Discount cannot be negative.');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // ── Item handlers ──────────────────────────────────────────────────────────

  const handleItemChange = (index: number, field: keyof InvoiceItem, val: any) => {
    const newItems = [...invoice.items];
    newItems[index] = { ...newItems[index], [field]: val };
    onChange(recalc({ ...invoice, items: newItems }));
    if (validationErrors.length > 0) setValidationErrors([]);
  };

  const handleAddItem = () => {
    onChange(
      recalc({
        ...invoice,
        items: [
          ...invoice.items,
          { product_name: '', quantity: 1, unit_price: 0, amount: 0 },
        ],
      })
    );
    if (validationErrors.length > 0) setValidationErrors([]);
  };

  const handleRemoveItem = (index: number) => {
    if (invoice.items.length <= 1) {
      setValidationErrors(['An invoice must have at least one line item.']);
      return;
    }
    onChange(
      recalc({
        ...invoice,
        items: invoice.items.filter((_, i) => i !== index),
      })
    );
  };

  // ── Financial field handlers ───────────────────────────────────────────────

  const handleGstRateChange = (val: number) => {
    onChange(recalc({ ...invoice, gst_rate: isNaN(val) ? 0 : val }));
  };

  const handleDiscountChange = (val: number) => {
    onChange(recalc({ ...invoice, discount: isNaN(val) ? 0 : val }));
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSaveClick = async () => {
    if (!validate()) {
      return;
    }
    try {
      await onSave(invoice);
      setSaveSuccess(true);
      setValidationErrors([]);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setValidationErrors([err.message || 'Failed to save invoice.']);
    }
  };

  const handleDeleteClick = async () => {
    if (onDelete && invoice.id) {
      await onDelete(invoice.id);
    }
  };

  const handlePrint = () => window.print();

  const handleWhatsAppShare = () => {
    let businessName = 'Our Business';
    const cached = localStorage.getItem('wi_profile');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.business_name) businessName = parsed.business_name;
      } catch {}
    }
    const url = generateWhatsAppShareUrl({ invoice, businessName });
    window.open(url, '_blank');
  };

  const currency = invoice.currency || '₹';

  return (
    <div className="w-full bg-white border border-slate-200 rounded-lg p-6 space-y-6 print:hidden shadow-xs">
      {/* ── Header & Action Buttons ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Invoice Editor</h2>
            <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 rounded border border-blue-200">
              {invoice.invoice_number}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Live client arithmetic with Decimal.js • Recalculated server-side on save
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving…' : 'Save Invoice'}</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share on WhatsApp</span>
          </button>

          {onDelete && invoice.id && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Deleting…' : 'Delete'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-rose-900 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>Are you sure you want to permanently delete this invoice ({invoice.invoice_number})?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2.5 py-1 text-xs font-medium bg-white text-slate-700 border border-slate-300 rounded hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                handleDeleteClick();
              }}
              disabled={isDeleting}
              className="px-2.5 py-1 text-xs font-semibold bg-rose-600 text-white rounded hover:bg-rose-700"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Validation Errors Banner ─────────────────────────────────────── */}
      {validationErrors.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Please correct the following errors:</span>
          </div>
          <ul className="list-disc list-inside text-xs text-rose-700 space-y-0.5 pl-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Extraction Issues Badges ─────────────────────────────────────── */}
      <IssueBadges
        issues={invoice.extraction_issues ?? []}
        onDismiss={(i) =>
          onChange({
            ...invoice,
            extraction_issues: (invoice.extraction_issues ?? []).filter((_, idx) => idx !== i),
          })
        }
      />

      {/* ── Customer Details (Full Editable Fields) ───────────────────────── */}
      <div className="space-y-3 bg-slate-50/70 p-4 rounded-md border border-slate-200">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Customer Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Customer Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={invoice.customer_name}
              onChange={(e) => {
                onChange({ ...invoice, customer_name: e.target.value });
                if (validationErrors.length > 0) setValidationErrors([]);
              }}
              className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              placeholder="e.g. Rahul Sharma"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">WhatsApp Phone</label>
            <input
              type="text"
              value={invoice.customer_phone || ''}
              onChange={(e) => onChange({ ...invoice, customer_phone: e.target.value })}
              className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={invoice.customer_email || ''}
              onChange={(e) => onChange({ ...invoice, customer_email: e.target.value })}
              className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              placeholder="customer@example.com"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={invoice.status}
              onChange={(e) => onChange({ ...invoice, status: e.target.value as any })}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1 text-xs">Customer Address</label>
          <input
            type="text"
            value={invoice.customer_address || ''}
            onChange={(e) => onChange({ ...invoice, customer_address: e.target.value })}
            className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            placeholder="Shop 12, Main Market, Mumbai, Maharashtra 400001"
          />
        </div>
      </div>

      {/* ── Line Items Table ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Line Items ({invoice.items.length})
          </h3>
          <button
            onClick={handleAddItem}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2 px-3">Item / Service Name *</th>
                <th className="py-2 px-3 w-28 text-center">Qty *</th>
                <th className="py-2 px-3 w-36 text-right">Unit Price ({currency}) *</th>
                <th className="py-2 px-3 w-36 text-right">Amount ({currency})</th>
                <th className="py-2 px-2 w-10 text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                    No items yet. Click &quot;Add Item&quot; to create a line item.
                  </td>
                </tr>
              )}
              {invoice.items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={item.product_name}
                      onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                      placeholder="Product or service description"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-center text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.unit_price}
                      onChange={(e) =>
                        handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-right text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                    {item.amount.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Remove line item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Financial Summary & Notes ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Notes / Payment Terms
          </label>
          <textarea
            rows={4}
            value={invoice.notes || ''}
            onChange={(e) => onChange({ ...invoice, notes: e.target.value })}
            className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            placeholder="e.g. Thanks for your business! Bank transfer / UPI details..."
          />
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2.5 text-xs text-slate-700">
          <div className="flex justify-between">
            <span className="text-slate-600 font-medium">Subtotal:</span>
            <span className="font-mono font-semibold text-slate-900">
              {currency} {invoice.subtotal.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">GST (%):</span>
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={invoice.gst_rate}
                onChange={(e) => handleGstRateChange(parseFloat(e.target.value) || 0)}
                className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs text-center text-slate-900 focus:border-blue-600 focus:outline-none bg-white"
              />
            </div>
            <span className="font-mono font-medium text-slate-900">
              + {currency} {invoice.gst_amount.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">Discount ({currency}):</span>
              <input
                type="number"
                min="0"
                step="any"
                value={invoice.discount}
                onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-xs text-right text-slate-900 focus:border-blue-600 focus:outline-none bg-white"
              />
            </div>
            <span className="font-mono font-medium text-slate-900">
              - {currency} {invoice.discount.toFixed(2)}
            </span>
          </div>

          <div className="border-t border-slate-300 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
            <span>Total Amount:</span>
            <span className="font-mono text-base text-blue-700">
              {currency} {invoice.total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
