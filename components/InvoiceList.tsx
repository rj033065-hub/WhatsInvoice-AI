'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Invoice } from '@/lib/types/invoice';
import {
  Search,
  Filter,
  Eye,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => Promise<void>;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  onSelectInvoice,
  onDeleteInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customer_phone && inv.customer_phone.includes(searchTerm));

    const matchesStatus =
      statusFilter === 'all' ? true : inv.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const totalRevenue = invoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
  // balance_due is not in the new schema — use total - 0 as placeholder
  const totalPaid = 0; // amount_paid removed from invoice table — tracked separately if needed
  const totalPendingBalance = invoices
    .filter((inv) => inv.status !== 'paid')
    .reduce((acc, inv) => acc + (inv.total || 0), 0);

  return (
    <div className="w-full space-y-4 print:hidden">
      {/* Clean High-Density Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-slate-200 rounded-lg p-4">
        <div className="border-r border-slate-100 last:border-0 pr-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Revenue
          </span>
          <span className="text-xl font-bold font-mono text-slate-900">
            ₹ {totalRevenue.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">{invoices.length} invoices total</span>
        </div>

        <div className="border-r border-slate-100 last:border-0 px-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Collected Payments
          </span>
          <span className="text-xl font-bold font-mono text-emerald-700">
            ₹ {totalPaid.toFixed(2)}
          </span>
          <span className="text-[11px] text-emerald-600 block mt-0.5 font-medium">Received balance</span>
        </div>

        <div className="pl-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Outstanding Balance
          </span>
          <span className="text-xl font-bold font-mono text-amber-700">
            ₹ {totalPendingBalance.toFixed(2)}
          </span>
          <span className="text-[11px] text-amber-600 block mt-0.5 font-medium">Pending customer payment</span>
        </div>
      </div>

      {/* Database Invoices Grid */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Saved Invoice Database
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">({filteredInvoices.length})</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, phone, INV..."
                className="w-full rounded border border-slate-300 bg-slate-50 pl-8 pr-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="draft">Draft</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded text-slate-500 text-xs">
            No saved invoices found. Extract an order and click "Save Invoice".
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Invoice Number</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id || inv.invoice_number} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-medium text-blue-700">
                      {inv.invoice_number}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {inv.customer_name}
                      {inv.customer_phone && (
                        <span className="block text-[11px] font-normal text-slate-400">
                          {inv.customer_phone}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${
                          inv.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : inv.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                      ₹ {(inv.total || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-700">
                      {inv.status === 'paid' ? <span className="text-emerald-600">Paid</span> : `₹ ${(inv.total || 0).toFixed(2)}`}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onSelectInvoice(inv)}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded"
                          title="Open Editor"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {inv.id && (
                          <button
                            onClick={() => onDeleteInvoice(inv.id!)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
