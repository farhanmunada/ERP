import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconClipboard } from '../../shared/components/icons.tsx';
import { formatMoney, formatQty } from '../../shared/lib/format.ts';
import { createOpname, listStock, listWarehouses } from './inventory.api.ts';

export function OpnamePage() {
  const queryClient = useQueryClient();
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });

  const [warehouseId, setWarehouseId] = useState('');
  const [opnameDate, setOpnameDate] = useState(new Date().toISOString().slice(0, 10));
  const [counts, setCounts] = useState<Record<string, string>>({});

  const { data: stock } = useQuery({
    queryKey: ['stock', warehouseId],
    queryFn: () => listStock(warehouseId ? { warehouseId } : {}),
    enabled: Boolean(warehouseId),
  });

  const mutation = useMutation({
    mutationFn: createOpname,
    onSuccess: async () => {
      setCounts({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
        queryClient.invalidateQueries({ queryKey: ['movements'] }),
      ]);
    },
  });

  const rows = useMemo(() => (warehouseId ? stock ?? [] : []), [stock, warehouseId]);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const lines = rows
      .filter((row) => counts[row.itemId] !== undefined && counts[row.itemId] !== '')
      .map((row) => ({ itemId: row.itemId, physicalQty: counts[row.itemId]! }));
    if (lines.length === 0) return;
    mutation.mutate({ warehouseId, opnameDate, lines });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stock Opname"
        description="Hitung fisik stok; selisih otomatis menyesuaikan saldo dan men-generate jurnal penyesuaian."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="opWarehouse">Gudang</label>
            <select id="opWarehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className="field text-sm">
              <option value="">Pilih gudang…</option>
              {(warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="opDate">Tanggal Opname</label>
            <input id="opDate" type="date" value={opnameDate} onChange={(e) => setOpnameDate(e.target.value)} required className="field text-sm" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={mutation.isPending || rows.length === 0} className="btn-primary">
              {mutation.isPending ? 'Memproses…' : 'Posting Opname'}
            </button>
          </div>
        </div>

        {mutation.isError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{mutation.error.message}</div> : null}
        {mutation.isSuccess ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Opname <span className="font-mono font-semibold">{mutation.data.docNumber}</span> terposting.
            {mutation.data.journalEntryId ? ' Jurnal penyesuaian dibuat.' : ' Tanpa selisih — tidak ada jurnal.'}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Item</th>
                <th className="px-5 py-3.5 text-right">Sistem</th>
                <th className="px-5 py-3.5 text-right">Avg Cost</th>
                <th className="px-5 py-3.5 text-right">Hitung Fisik</th>
                <th className="px-5 py-3.5 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const physical = counts[row.itemId];
                const diff = physical !== undefined && physical !== '' ? Number(physical) - Number(row.onHand) : null;
                return (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{row.itemName}</p>
                      <p className="font-mono text-[11px] text-slate-400">{row.itemCode}</p>
                    </td>
                    <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-700">{formatQty(row.onHand)}</td>
                    <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-500">{formatMoney(row.avgCost)}</td>
                    <td className="px-5 py-4 text-right">
                      <input
                        value={counts[row.itemId] ?? ''}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [row.itemId]: e.target.value }))}
                        className="field-mono w-32 text-sm"
                        placeholder={row.onHand}
                      />
                    </td>
                    <td className="tabular px-5 py-4 text-right font-mono text-xs">
                      {diff === null ? <span className="text-slate-300">—</span> : (
                        <span className={diff === 0 ? 'text-slate-500' : diff > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {diff > 0 ? '+' : ''}{formatQty(diff)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted">
                    <IconClipboard className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">{warehouseId ? 'Belum Ada Stok di Gudang Ini' : 'Pilih Gudang'}</p>
                    <p className="text-xs text-slate-400 mt-1">{warehouseId ? 'Catat Stock In terlebih dahulu.' : 'Pilih gudang untuk memuat daftar item yang dihitung.'}</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">Item tanpa isi kolom "Hitung Fisik" akan diabaikan.</p>
      </form>
    </div>
  );
}
