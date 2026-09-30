import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconFileText, IconPlus } from '../../shared/components/icons.tsx';
import { formatMoney } from '../../shared/lib/format.ts';
import { createInvoice, listDeliveries, listInvoices } from './sales.api.ts';
import { InvoiceModal } from './InvoiceModal.tsx';

const STATUS_STYLE: Record<string, string> = {
  POSTED: 'bg-indigo-50 text-primary ring-1 ring-inset ring-primary/20',
  VOID: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
};

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const { data: invoices, isLoading, error } = useQuery({ queryKey: ['invoices'], queryFn: listInvoices });
  const { data: deliveries } = useQuery({ queryKey: ['deliveries'], queryFn: listDeliveries });

  const [doId, setDoId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [tax, setTax] = useState('0');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: async () => {
      setDoId('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['salesOrders'] }),
      ]);
    },
  });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    mutation.mutate({ doId, invoiceDate, tax });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customer Invoice"
        description="Faktur penjualan dengan jurnal otomatis Debit Piutang / Credit Penjualan (dan PPN Keluaran) serta Debit HPP / Credit Persediaan."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {invoices?.length ?? 0} Invoice
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Buat Faktur dari Pengiriman</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="invDo">Delivery Order</label>
            <select id="invDo" value={doId} onChange={(e) => setDoId(e.target.value)} required className="field text-sm">
              <option value="">Pilih pengiriman…</option>
              {(deliveries ?? []).map((delivery) => (
                <option key={delivery.id} value={delivery.id}>{delivery.docNumber} — {delivery.soDocNumber}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="invDate">Tanggal</label>
            <input id="invDate" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required className="field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="invTax">PPN (IDR)</label>
            <input id="invTax" value={tax} onChange={(e) => setTax(e.target.value)} className="field-mono text-sm" placeholder="0" />
          </div>
          <div className="flex items-end justify-end">
            <button type="submit" disabled={!doId || mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Memproses…' : 'Posting Faktur'}
            </button>
          </div>
          {mutation.isError ? (
            <div className="sm:col-span-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {mutation.error.message}
            </div>
          ) : null}
        </form>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div> : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">No. Dokumen</th>
              <th className="px-5 py-3.5">Tanggal</th>
              <th className="px-5 py-3.5">Customer</th>
              <th className="px-5 py-3.5 text-right">Total</th>
              <th className="px-5 py-3.5 text-right">HPP</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(invoices ?? []).map((invoice) => (
              <tr key={invoice.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">{invoice.docNumber}</td>
                <td className="px-5 py-4 text-slate-600">{invoice.invoiceDate}</td>
                <td className="px-5 py-4 text-slate-700">{invoice.customerName}</td>
                <td className="tabular px-5 py-4 text-right font-mono text-xs font-semibold text-slate-900">{formatMoney(invoice.total)}</td>
                <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-500">{formatMoney(invoice.cogs)}</td>
                <td className="px-5 py-4">
                  <span className={`badge ${STATUS_STYLE[invoice.status] ?? 'bg-slate-100 text-slate-700'}`}>{invoice.status}</span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button type="button" onClick={() => setSelectedId(invoice.id)} className="btn-secondary px-3 py-1.5 text-xs">
                    Detail
                  </button>
                </td>
              </tr>
            ))}
            {(invoices ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-muted">
                  <IconFileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Faktur</p>
                  <p className="text-xs text-slate-400 mt-1">Buat faktur dari Delivery Order yang sudah dikirim.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedId ? <InvoiceModal invoiceId={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
