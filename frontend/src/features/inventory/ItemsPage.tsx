import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconBox, IconPlus } from '../../shared/components/icons.tsx';
import { formatQty } from '../../shared/lib/format.ts';
import { createItem, listItems } from './inventory.api.ts';

const COSTING_LABEL: Record<string, string> = {
  MOVING_AVERAGE: 'Moving Average',
  FIFO: 'FIFO',
};

export function ItemsPage() {
  const queryClient = useQueryClient();
  const { data: items, isLoading, error } = useQuery({ queryKey: ['items'], queryFn: listItems });

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [uom, setUom] = useState('PCS');
  const [costingMethod, setCostingMethod] = useState('MOVING_AVERAGE');
  const [trackBatch, setTrackBatch] = useState(false);
  const [trackSerial, setTrackSerial] = useState(false);
  const [reorderPoint, setReorderPoint] = useState('0');

  const mutation = useMutation({
    mutationFn: createItem,
    onSuccess: async () => {
      setCode('');
      setName('');
      setReorderPoint('0');
      setTrackBatch(false);
      setTrackSerial(false);
      await queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    mutation.mutate({ code, name, uom, costingMethod, trackBatch, trackSerial, reorderPoint });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Master Item"
        description="Katalog barang dagang dengan metode costing dan pelacakan batch/serial per item."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {items?.length ?? 0} Item
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Tambah Item Baru</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-6 sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="itemCode">Kode</label>
            <input id="itemCode" value={code} onChange={(e) => setCode(e.target.value)} required className="field font-mono text-sm" placeholder="ITM-005" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="itemName">Nama Item</label>
            <input id="itemName" value={name} onChange={(e) => setName(e.target.value)} required className="field text-sm" placeholder="Kopi Robusta 1kg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="itemUom">UoM</label>
            <input id="itemUom" value={uom} onChange={(e) => setUom(e.target.value)} required className="field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="itemCosting">Costing</label>
            <select id="itemCosting" value={costingMethod} onChange={(e) => setCostingMethod(e.target.value)} className="field text-sm">
              <option value="MOVING_AVERAGE">Moving Average</option>
              <option value="FIFO">FIFO</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="itemReorder">Reorder Point</label>
            <input id="itemReorder" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="field-mono text-sm" />
          </div>

          <div className="sm:col-span-6 flex flex-wrap items-center gap-6 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={trackBatch} onChange={(e) => setTrackBatch(e.target.checked)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30" />
              Lacak Batch
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={trackSerial} onChange={(e) => setTrackSerial(e.target.checked)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30" />
              Lacak Serial Number
            </label>
          </div>

          <div className="sm:col-span-6 flex items-center justify-between pt-2">
            {mutation.isError ? <span className="text-xs font-medium text-rose-600">{mutation.error.message}</span> : <span />}
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Menyimpan…' : 'Simpan Item'}
            </button>
          </div>
        </form>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div> : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3.5">Kode</th>
              <th className="px-6 py-3.5">Nama</th>
              <th className="px-6 py-3.5">UoM</th>
              <th className="px-6 py-3.5">Costing</th>
              <th className="px-6 py-3.5">Tracking</th>
              <th className="px-6 py-3.5 text-right">Reorder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(items ?? []).map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">
                  <span className="rounded bg-slate-100 px-2 py-1 text-slate-800">{item.code}</span>
                </td>
                <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                <td className="px-6 py-4 text-slate-600">{item.uom}</td>
                <td className="px-6 py-4">
                  <span className="badge bg-indigo-50 text-primary ring-1 ring-inset ring-primary/20">
                    {COSTING_LABEL[item.costingMethod] ?? item.costingMethod}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1.5">
                    {item.trackBatch ? <span className="badge bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">Batch</span> : null}
                    {item.trackSerial ? <span className="badge bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20">Serial</span> : null}
                    {!item.trackBatch && !item.trackSerial ? <span className="text-xs text-slate-400">—</span> : null}
                  </div>
                </td>
                <td className="tabular px-6 py-4 text-right font-mono text-xs text-slate-600">{formatQty(item.reorderPoint)}</td>
              </tr>
            ))}
            {(items ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted">
                  <IconBox className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Item</p>
                  <p className="text-xs text-slate-400 mt-1">Gunakan formulir di atas untuk menambahkan item pertama.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
