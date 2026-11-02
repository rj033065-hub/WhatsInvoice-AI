'use client';

import React, { useState } from 'react';
import { Invoice } from '@/lib/types/invoice';
import {
  Search,
  Eye,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { CountUp } from '@/components/motion/CountUp';
import { Stagger, staggerItemVariants } from '@/components/motion/Stagger';

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  onSelectInvoice,
  onDeleteInvoice,
  isLoading = false,
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
      {isLoading ? (
        <div className="grid min-h-[108px] grid-cols-1 gap-3 sm:grid-cols-3" role="status" aria-label="Loading invoice totals">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="motion-card rounded-2xl border border-slate-200 bg-white p-4">
              <div className="skeleton-shimmer mb-3 h-3 w-28 rounded" />
              <div className="skeleton-shimmer h-6 w-36 rounded" />
              <div className="skeleton-shimmer mt-2 h-3 w-24 rounded" />
            </div>
          ))}
        </div>
      ) : (
      <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <motion.div variants={staggerItemVariants} whileHover={{ y: -2 }} className="motion-card rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Revenue
          </span>
          <CountUp value={totalRevenue} className="text-xl font-bold font-mono tabular-nums text-slate-900" />
          <span className="text-[11px] text-slate-400 block mt-0.5">{invoices.length} invoices total</span>
        </motion.div>

        <motion.div variants={staggerItemVariants} whileHover={{ y: -2 }} className="motion-card rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Collected Payments
          </span>
          <CountUp value={totalPaid} className="text-xl font-bold font-mono tabular-nums text-text" />
          <span className="text-[11px] text-emerald-600 block mt-0.5 font-medium">Received balance</span>
        </motion.div>

        <motion.div variants={staggerItemVariants} whileHover={{ y: -2 }} className="motion-card rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Outstanding Balance
          </span>
          <CountUp value={totalPendingBalance} className="text-xl font-bold font-mono tabular-nums text-text" />
          <span className="text-[11px] text-amber-600 block mt-0.5 font-medium">Pending customer payment</span>
        </motion.div>
      </Stagger>
      )}

      {/* Database Invoices Grid */}
      <div className="motion-card bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
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

        {isLoading ? (
          <div className="min-h-[240px] space-y-3 py-2" role="status" aria-label="Loading invoices">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="grid h-9 grid-cols-4 items-center gap-4 border-b border-slate-200 px-3 sm:grid-cols-7">
                <span className="skeleton-shimmer h-3 w-20 rounded" />
                <span className="skeleton-shimmer h-3 w-28 rounded" />
                <span className="skeleton-shimmer hidden h-3 w-20 rounded sm:block" />
                <span className="skeleton-shimmer h-5 w-16 rounded-full" />
                <span className="skeleton-shimmer hidden h-3 w-16 justify-self-end rounded sm:block" />
                <span className="skeleton-shimmer hidden h-3 w-16 justify-self-end rounded sm:block" />
                <span className="skeleton-shimmer hidden h-5 w-12 justify-self-center rounded sm:block" />
              </div>
            ))}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded text-slate-500 text-xs">
            No saved invoices found. Extract an order and click &quot;Save Invoice&quot;.
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
              <Stagger as="tbody" className="divide-y divide-slate-200">
                {filteredInvoices.map((inv) => (
                  <motion.tr variants={staggerItemVariants} key={inv.id || inv.invoice_number} className="hover:bg-slate-50">
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
                  </motion.tr>
                ))}
              </Stagger>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
