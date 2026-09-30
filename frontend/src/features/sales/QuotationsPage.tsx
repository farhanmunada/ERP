import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconCart, IconPlus } from '../../shared/components/icons.tsx';
import { formatMoney } from '../../shared/lib/format.ts';
import { listItems, listWarehouses } from '../inventory/inventory.api.ts';
import {
  acceptQuotation,
  convertQuotationToSo,
  createQuotation,
  getQuotation,
  listCustomers,
  listQuotations,
} from './sales.api.ts';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ACCEPTED: 'Disetujui',
  CONVERTED: 'Dikonversi',
};

export function QuotationsPage() {
  const queryClient = useQueryClient();
  const { data: quotations, isLoading, error } = useQuery({ queryKey: ['quotations'], queryFn: listQuotations });
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: listCustomers });
  const { data: items } = useQuery({ queryKey: ['items'], queryFn: listItems });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });

  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertTotal, setConvertTotal] = useState('0.00');
  const [warehouseId, setWarehouseId] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['quotations'] });

  const createMutation = useMutation({
    mutationFn: createQuotation,
    onSuccess: async () => {
      setItemId('');
      setQty('');
      setUnitPrice('');
      await invalidate();
    },
  });

  const acceptMutation = useMutation({ mutationFn: acceptQuotation, onSuccess: invalidate });

  const convertMutation = useMutation({
    mutationFn: (payload: { id: string; warehouseId: string }) =>
      convertQuotationToSo(payload.id, { warehouseId: payload.warehouseId, soDate: new Date().toISOString().slice(0, 10) }),
    onSuccess: async () => {
      setConvertId(null);
      setWarehouseId('');
      await Promise.all([invalidate(), queryClient.invalidateQueries({ queryKey: ['salesOrders'] })]);
    },
  });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    createMutation.mutate({ quoteDate, customerId, tax: '0', lines: [{ itemId, qty, unitPrice }] });
  }

  async function openConvert(id: string): Promise<void> {
    const detail = await getQuotation(id);
    setConvertTotal(detail.total);
    setConvertId(id);
    setWarehouseId('');
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quotation"
        description="Penawaran harga ke pelanggan. Setelah disetujui, quotation dapat dikonversi menjadi Sales Order."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {quotations?.length ?? 0} Quotation
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Buat Quotation Baru</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-6 sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="qDate">Tanggal</label>
            <input id="qDate" type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} required className="field text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="qCust">Customer</label>
            <select id="qCust" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="field text-sm">
              <option value="">Pilih customer…</option>
              {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="qItem">Item</label>
            <select id="qItem" value={itemId} onChange={(e) => setItemId(e.target.value)} required className="field text-sm">
              <option value="">Pilih item…</option>
              {(items ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="qQty">Kuantitas</label>
            <input id="qQty" value={qty} onChange={(e) => setQty(e.target.value)} required className="field-mono text-sm" placeholder="0" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="qPrice">Harga Satuan</label>
            <input id="qPrice" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required className="field-mono text-sm" placeholder="15000" />
          </div>

          <div className="sm:col-span-6 flex items-center justify-between pt-1">
            {createMutation.isError ? <span className="text-xs font-medium text-rose-600">{createMutation.error.message}</span> : <span />}
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan Quotation'}
            </button>
          </div>
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
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(quotations ?? []).map((q) => (
              <tr key={q.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">{q.docNumber}</td>
                <td className="px-5 py-4 text-slate-600">{q.quoteDate}</td>
                <td className="px-5 py-4 text-slate-700">{q.customerName}</td>
                <td className="tabular px-5 py-4 text-right font-mono text-xs font-semibold text-slate-800">{formatMoney(q.total)}</td>
                <td className="px-5 py-4">
                  <span className={q.status === 'DRAFT' ? 'badge bg-slate-100 text-slate-700' : q.status === 'ACCEPTED' ? 'badge bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' : 'badge bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'}>
                    {STATUS_LABEL[q.status] ?? q.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  {q.status === 'DRAFT' ? (
                    <button type="button" onClick={() => acceptMutation.mutate(q.id)} disabled={acceptMutation.isPending} className="btn-secondary px-3 py-1.5 text-xs">
                      Setujui
                    </button>
                  ) : q.status === 'ACCEPTED' ? (
                    <button type="button" onClick={() => void openConvert(q.id)} className="btn-secondary px-3 py-1.5 text-xs">
                      Konversi ke SO
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {(quotations ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted">
                  <IconCart className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Quotation</p>
                  <p className="text-xs text-slate-400 mt-1">Buat penawaran harga untuk pelanggan.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {convertId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-lg">
            <h2 className="text-lg font-bold tracking-tight text-text">Konversi Quotation → Sales Order</h2>
            <p className="mt-1 text-sm text-muted">Pilih gudang sumber stok untuk Sales Order.</p>

            <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-slate-50/60 px-3 py-2 text-sm">
              <span className="text-slate-500">Total Quotation</span>
              <span className="tabular font-mono font-semibold text-slate-800">{formatMoney(convertTotal)}</span>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="cvWh">Gudang</label>
              <select id="cvWh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="field text-sm">
                <option value="">Pilih gudang…</option>
                {(warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            {convertMutation.isError ? <p className="mt-3 text-xs font-medium text-rose-600">{convertMutation.error.message}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConvertId(null)} className="btn-secondary">Batal</button>
              <button
                type="button"
                disabled={!warehouseId || convertMutation.isPending}
                onClick={() => convertMutation.mutate({ id: convertId, warehouseId })}
                className="btn-primary"
              >
                {convertMutation.isPending ? 'Memproses…' : 'Buat Sales Order'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
