import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconList } from '../../shared/components/icons.tsx';
import { formatMoney, formatQty } from '../../shared/lib/format.ts';
import { listItems, listMovements } from './inventory.api.ts';

const TYPE_META: Record<string, { label: string; badgeClass: string; sign: string }> = {
  STOCK_IN: { label: 'Stock In', badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', sign: '+' },
  STOCK_OUT: { label: 'Stock Out', badgeClass: 'bg-rose-50 text-rose-700 ring-rose-600/20', sign: '−' },
  TRANSFER_IN: { label: 'Transfer Masuk', badgeClass: 'bg-blue-50 text-blue-700 ring-blue-600/20', sign: '+' },
  TRANSFER_OUT: { label: 'Transfer Keluar', badgeClass: 'bg-amber-50 text-amber-700 ring-amber-600/20', sign: '−' },
  OPNAME_ADJUSTMENT: { label: 'Penyesuaian Opname', badgeClass: 'bg-purple-50 text-purple-700 ring-purple-600/20', sign: '±' },
};

export function MovementsPage() {
  const [itemId, setItemId] = useState('');
  const { data: items } = useQuery({ queryKey: ['items'], queryFn: listItems });
  const { data: movements, isLoading } = useQuery({
    queryKey: ['movements', itemId],
    queryFn: () => listMovements(itemId ? { itemId } : {}),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Riwayat Mutasi Stok"
        description="Ledger pergerakan stok append-only — setiap baris tercatat permanen."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {movements?.length ?? 0} Mutasi
          </span>
        }
        actions={
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="field text-sm sm:w-64">
            <option value="">Semua Item</option>
            {(items ?? []).map((item) => (
              <option key={item.id} value={item.id}>{item.code} — {item.name}</option>
            ))}
          </select>
        }
      />

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Waktu</th>
              <th className="px-5 py-3.5">Item</th>
              <th className="px-5 py-3.5">Tipe</th>
              <th className="px-5 py-3.5 text-right">Qty</th>
              <th className="px-5 py-3.5 text-right">Harga</th>
              <th className="px-5 py-3.5 text-right">Saldo Qty</th>
              <th className="px-5 py-3.5">Referensi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(movements ?? []).map((movement) => {
              const meta = TYPE_META[movement.movementType] ?? { label: movement.movementType, badgeClass: 'bg-slate-50 text-slate-700 ring-slate-600/20', sign: '' };
              return (
                <tr key={movement.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-mono text-[11px] text-slate-500">{movement.createdAt.replace('T', ' ').slice(0, 19)}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{movement.itemName}</p>
                    <p className="font-mono text-[11px] text-slate-400">{movement.itemCode}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`badge ring-1 ring-inset ${meta.badgeClass}`}>{meta.label}</span>
                  </td>
                  <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-900">{meta.sign}{formatQty(movement.quantity)}</td>
                  <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-600">{formatMoney(movement.unitCost)}</td>
                  <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-600">{formatQty(movement.balanceQty)}</td>
                  <td className="px-5 py-4 text-xs text-slate-500">
                    {movement.referenceType ? `${movement.referenceType}` : '—'}
                    {movement.batchNo ? <span className="ml-1 font-mono text-[11px] text-slate-400">· {movement.batchNo}</span> : null}
                  </td>
                </tr>
              );
            })}
            {(movements ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-muted">
                  <IconList className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Mutasi</p>
                  <p className="text-xs text-slate-400 mt-1">Mutasi muncul setelah ada transaksi Stock In/Out, Transfer, atau Opname.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
