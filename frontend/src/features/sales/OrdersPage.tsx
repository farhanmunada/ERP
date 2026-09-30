import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconTruck, IconPlus } from '../../shared/components/icons.tsx';
import { formatMoney } from '../../shared/lib/format.ts';
import { listItems, listWarehouses } from '../inventory/inventory.api.ts';
import {
  cancelSalesOrder,
  confirmSalesOrder,
  createSalesOrder,
  listCustomers,
  listSalesOrders,
} from './sales.api.ts';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Dikonfirmasi',
  PARTIALLY_DELIVERED: 'Kirim Sebagian',
  DELIVERED: 'Terkirim',
  INVOICED: 'Terfaktur',
  CLOSED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

const CANCELLABLE = new Set(['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED']);

export function OrdersPage() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading, error } = useQuery({ queryKey: ['salesOrders'], queryFn: listSalesOrders });
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: listCustomers });
  const { data: items } = useQuery({ queryKey: ['items'], queryFn: listItems });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });

  const [soDate, setSoDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] }),
      queryClient.invalidateQueries({ queryKey: ['stock'] }),
    ]);

  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: async () => {
      setItemId('');
      setQty('');
      setUnitPrice('');
      await invalidate();
    },
  });

  const confirmMutation = useMutation({ mutationFn: confirmSalesOrder, onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: cancelSalesOrder, onSuccess: invalidate });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    createMutation.mutate({ soDate, customerId, warehouseId, tax: '0', lines: [{ itemId, qty, unitPrice }] });
  }

  const actionError = confirmMutation.error ?? cancelMutation.error;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sales Order"
        description="Konfirmasi SO memeriksa credit limit customer lalu melakukan soft-reserve stok secara otomatis."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {orders?.length ?? 0} SO
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Buat Sales Order Baru</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-6 sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="soDate">Tanggal</label>
            <input id="soDate" type="date" value={soDate} onChange={(e) => setSoDate(e.target.value)} required className="field text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="soCust">Customer</label>
            <select id="soCust" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="field text-sm">
              <option value="">Pilih customer…</option>
              {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="soWh">Gudang Sumber</label>
            <select id="soWh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className="field text-sm">
              <option value="">Pilih gudang…</option>
              {(warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="soItem">Item</label>
            <select id="soItem" value={itemId} onChange={(e) => setItemId(e.target.value)} required className="field text-sm">
              <option value="">Pilih item…</option>
              {(items ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="soQty">Kuantitas</label>
            <input id="soQty" value={qty} onChange={(e) => setQty(e.target.value)} required className="field-mono text-sm" placeholder="0" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="soPrice">Harga Satuan</label>
            <input id="soPrice" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required className="field-mono text-sm" placeholder="15000" />
          </div>

          <div className="sm:col-span-6 flex items-center justify-between pt-1">
            {createMutation.isError ? <span className="text-xs font-medium text-rose-600">{createMutation.error.message}</span> : <span />}
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan Sales Order'}
            </button>
          </div>
        </form>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div> : null}
      {actionError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{actionError.message}</div> : null}

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
            {(orders ?? []).map((so) => (
              <tr key={so.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">{so.docNumber}</td>
                <td className="px-5 py-4 text-slate-600">{so.soDate}</td>
                <td className="px-5 py-4 text-slate-700">{so.customerName}</td>
                <td className="tabular px-5 py-4 text-right font-mono text-xs font-semibold text-slate-800">{formatMoney(so.total)}</td>
                <td className="px-5 py-4">
                  <span className={so.status === 'DRAFT' ? 'badge bg-slate-100 text-slate-700' : so.status === 'CANCELLED' ? 'badge bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20' : 'badge bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'}>
                    {STATUS_LABEL[so.status] ?? so.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {so.status === 'DRAFT' ? (
                      <button type="button" onClick={() => confirmMutation.mutate(so.id)} disabled={confirmMutation.isPending} className="btn-secondary px-3 py-1.5 text-xs">
                        Konfirmasi
                      </button>
                    ) : null}
                    {CANCELLABLE.has(so.status) ? (
                      <button type="button" onClick={() => cancelMutation.mutate(so.id)} disabled={cancelMutation.isPending} className="btn-secondary px-3 py-1.5 text-xs text-rose-600">
                        Batalkan
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {(orders ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted">
                  <IconTruck className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Sales Order</p>
                  <p className="text-xs text-slate-400 mt-1">Buat sales order atau konversi dari quotation.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
