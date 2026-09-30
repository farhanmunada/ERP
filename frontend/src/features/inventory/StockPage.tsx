import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconArrowRight, IconBox, IconWarehouse } from '../../shared/components/icons.tsx';
import { formatMoney, formatQty } from '../../shared/lib/format.ts';
import { listItems, listStock, listWarehouses, stockIn, stockOut } from './inventory.api.ts';

type Mode = 'IN' | 'OUT';

export function StockPage() {
  const queryClient = useQueryClient();
  const { data: stock, isLoading } = useQuery({ queryKey: ['stock'], queryFn: () => listStock() });
  const { data: items } = useQuery({ queryKey: ['items'], queryFn: listItems });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });

  const [mode, setMode] = useState<Mode>('IN');
  const [itemId, setItemId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [batchNo, setBatchNo] = useState('');

  const selectedItem = items?.find((item) => item.id === itemId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'IN') {
        return stockIn({ itemId, warehouseId, quantity, unitCost, ...(batchNo ? { batchNo } : {}) });
      }
      return stockOut({ itemId, warehouseId, quantity });
    },
    onSuccess: async () => {
      setQuantity('');
      setUnitCost('');
      setBatchNo('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
        queryClient.invalidateQueries({ queryKey: ['movements'] }),
      ]);
    },
  });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    mutation.mutate();
  }

  const warehouseName = (id: string) => warehouses?.find((w) => w.id === id)?.name ?? '—';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Persediaan Stok"
        description="Posisi on-hand, reserved, dan nilai persediaan per item per gudang."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {stock?.length ?? 0} Baris Stok
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Form Mutasi */}
        <div className="card space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-border/80 pb-3">
            <IconBox className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold tracking-tight text-text">Mutasi Stok</h2>
          </div>

          <div className="flex rounded-lg bg-canvas p-1 ring-1 ring-inset ring-border">
            {(['IN', 'OUT'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
                  mode === value ? 'bg-surface text-primary shadow-xs' : 'text-muted hover:text-text'
                }`}
              >
                {value === 'IN' ? 'Stock In' : 'Stock Out'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="stockItem">Item</label>
              <select id="stockItem" value={itemId} onChange={(e) => setItemId(e.target.value)} required className="field text-sm">
                <option value="">Pilih item…</option>
                {(items ?? []).map((item) => (
                  <option key={item.id} value={item.id}>{item.code} — {item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="stockWarehouse">Gudang</label>
              <select id="stockWarehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className="field text-sm">
                <option value="">Pilih gudang…</option>
                {(warehouses ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="stockQty">Kuantitas</label>
              <input id="stockQty" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="field-mono text-sm" placeholder="0" />
            </div>
            {mode === 'IN' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="stockCost">Harga Satuan</label>
                  <input id="stockCost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required className="field-mono text-sm" placeholder="0.00" />
                </div>
                {selectedItem?.trackBatch ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="stockBatch">Nomor Batch (wajib)</label>
                    <input id="stockBatch" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} className="field text-sm" placeholder="B-001" />
                  </div>
                ) : null}
              </>
            ) : null}

            <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
              {mutation.isPending ? 'Memproses…' : mode === 'IN' ? 'Catat Stock In' : 'Catat Stock Out'}
            </button>

            {mutation.isError ? <p className="text-xs font-medium text-rose-600">{mutation.error.message}</p> : null}
            {mutation.isSuccess ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                Berhasil. On-hand sekarang {formatQty(mutation.data.onHand)}.
              </p>
            ) : null}
          </form>
        </div>

        {/* Tabel Stok */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Item</th>
                  <th className="px-5 py-3.5">Gudang</th>
                  <th className="px-5 py-3.5 text-right">On-hand</th>
                  <th className="px-5 py-3.5 text-right">Available</th>
                  <th className="px-5 py-3.5 text-right">Avg Cost</th>
                  <th className="px-5 py-3.5 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(stock ?? []).map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{row.itemName}</p>
                      <p className="font-mono text-[11px] text-slate-400">{row.itemCode}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{warehouseName(row.warehouseId)}</td>
                    <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-900">{formatQty(row.onHand)}</td>
                    <td className="tabular px-5 py-4 text-right font-mono text-xs text-emerald-700">{formatQty(row.available)}</td>
                    <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-600">{formatMoney(row.avgCost)}</td>
                    <td className="tabular px-5 py-4 text-right font-mono text-xs font-semibold text-slate-900">{formatMoney(row.value)}</td>
                  </tr>
                ))}
                {(stock ?? []).length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted">
                      <IconWarehouse className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700">Belum Ada Stok</p>
                      <p className="text-xs text-slate-400 mt-1">Catat Stock In untuk mulai mengisi persediaan.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <IconArrowRight className="h-3.5 w-3.5" />
            Available = on-hand − reserved (reserved termasuk transfer in-transit).
          </p>
        </div>
      </div>
    </div>
  );
}
