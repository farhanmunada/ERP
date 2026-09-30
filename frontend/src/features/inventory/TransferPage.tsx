import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconArrows, IconArrowRight } from '../../shared/components/icons.tsx';
import { formatQty } from '../../shared/lib/format.ts';
import { completeTransfer, createTransfer, listItems, listTransfers, listWarehouses } from './inventory.api.ts';

export function TransferPage() {
  const queryClient = useQueryClient();
  const { data: transfers, isLoading } = useQuery({ queryKey: ['transfers'], queryFn: listTransfers });
  const { data: items } = useQuery({ queryKey: ['items'], queryFn: listItems });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });

  const [itemId, setItemId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transfers'] }),
      queryClient.invalidateQueries({ queryKey: ['stock'] }),
      queryClient.invalidateQueries({ queryKey: ['movements'] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: async () => {
      setQuantity('');
      await invalidate();
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeTransfer,
    onSuccess: invalidate,
  });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    createMutation.mutate({ itemId, fromWarehouseId, toWarehouseId, quantity });
  }

  const itemLabel = (id: string) => {
    const item = items?.find((i) => i.id === id);
    return item ? `${item.code} — ${item.name}` : id;
  };
  const warehouseLabel = (id: string) => warehouses?.find((w) => w.id === id)?.name ?? '—';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Transfer Antar-Gudang"
        description="Pindahkan stok antar gudang. Selama in-transit, kuantitas terkunci dan tidak tersedia."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {transfers?.length ?? 0} Transfer
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconArrows className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Buat Transfer Baru</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-5 sm:items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="trItem">Item</label>
            <select id="trItem" value={itemId} onChange={(e) => setItemId(e.target.value)} required className="field text-sm">
              <option value="">Pilih item…</option>
              {(items ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.code} — {item.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="trFrom">Dari Gudang</label>
            <select id="trFrom" value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} required className="field text-sm">
              <option value="">Pilih…</option>
              {(warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="trTo">Ke Gudang</label>
            <select id="trTo" value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required className="field text-sm">
              <option value="">Pilih…</option>
              {(warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="trQty">Kuantitas</label>
            <input id="trQty" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="field-mono text-sm" placeholder="0" />
          </div>

          <div className="sm:col-span-5 flex items-center justify-between pt-1">
            {createMutation.isError ? <span className="text-xs font-medium text-rose-600">{createMutation.error.message}</span> : <span />}
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Memproses…' : 'Buat Transfer'}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">No. Dokumen</th>
              <th className="px-5 py-3.5">Item</th>
              <th className="px-5 py-3.5">Rute</th>
              <th className="px-5 py-3.5 text-right">Qty</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(transfers ?? []).map((transfer) => (
              <tr key={transfer.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">{transfer.docNumber}</td>
                <td className="px-5 py-4 text-slate-700">{itemLabel(transfer.itemId)}</td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    {warehouseLabel(transfer.fromWarehouseId)}
                    <IconArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    {warehouseLabel(transfer.toWarehouseId)}
                  </span>
                </td>
                <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-900">{formatQty(transfer.quantity)}</td>
                <td className="px-5 py-4">
                  {transfer.status === 'COMPLETED' ? (
                    <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Selesai</span>
                  ) : (
                    <span className="badge bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">In-Transit</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  {transfer.status === 'IN_TRANSIT' ? (
                    <button
                      type="button"
                      onClick={() => completeMutation.mutate(transfer.id)}
                      disabled={completeMutation.isPending}
                      className="btn-secondary px-3 py-1.5 text-xs"
                    >
                      Selesaikan
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {(transfers ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted">
                  <IconArrows className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Transfer</p>
                  <p className="text-xs text-slate-400 mt-1">Buat transfer untuk memindahkan stok antar gudang.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
