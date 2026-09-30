import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconFileText } from '../../shared/components/icons.tsx';
import { formatMoney, formatQty } from '../../shared/lib/format.ts';
import { getBill, listBills, overrideBill, postBill } from './procurement.api.ts';

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  MATCHED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  MATCH_EXCEPTION: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  POSTED: 'bg-indigo-50 text-primary ring-1 ring-inset ring-primary/20',
};

export function BillPage() {
  const queryClient = useQueryClient();
  const { data: bills, isLoading, error } = useQuery({ queryKey: ['bills'], queryFn: listBills });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data: detail } = useQuery({
    queryKey: ['bill', selectedId],
    queryFn: () => getBill(selectedId ?? ''),
    enabled: Boolean(selectedId),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bills'] }),
      queryClient.invalidateQueries({ queryKey: ['bill', selectedId] }),
    ]);
  };

  const overrideMutation = useMutation({
    mutationFn: () => overrideBill(selectedId ?? '', reason),
    onSuccess: async () => {
      setReason('');
      await invalidate();
    },
  });

  const postMutation = useMutation({
    mutationFn: () => postBill(selectedId ?? ''),
    onSuccess: invalidate,
  });

  const match = detail?.matchResult ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tagihan Vendor (Vendor Bill)"
        description="Tagihan pemasok dengan verifikasi 3-way matching (PO vs GRN vs Bill) dan posting jurnal Debit GRN Accrual / Credit Utang Usaha."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {bills?.length ?? 0} Bill
          </span>
        }
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div> : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">No. Dokumen</th>
              <th className="px-5 py-3.5">Vendor</th>
              <th className="px-5 py-3.5">Tanggal</th>
              <th className="px-5 py-3.5 text-right">Total</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(bills ?? []).map((bill) => (
              <tr key={bill.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">{bill.docNumber}</td>
                <td className="px-5 py-4 text-slate-700">{bill.vendorName}</td>
                <td className="px-5 py-4 text-slate-600">{bill.billDate}</td>
                <td className="tabular px-5 py-4 text-right font-mono text-xs font-semibold text-slate-900">{formatMoney(bill.total)}</td>
                <td className="px-5 py-4">
                  <span className={`badge ${STATUS_STYLE[bill.status] ?? 'bg-slate-100 text-slate-700'}`}>{bill.status}</span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(bill.id);
                      setReason('');
                    }}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Detail & Match
                  </button>
                </td>
              </tr>
            ))}
            {(bills ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted">
                  <IconFileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Tagihan</p>
                  <p className="text-xs text-slate-400 mt-1">Buat tagihan dari daftar PO yang sudah diterima.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedId && detail ? (
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-text">{detail.docNumber}</h2>
              <p className="text-xs text-muted">
                Subtotal {formatMoney(detail.subtotal)} · PPN {formatMoney(detail.tax)} · Total {formatMoney(detail.total)}
              </p>
            </div>
            <span className={`badge ${STATUS_STYLE[detail.status] ?? 'bg-slate-100 text-slate-700'}`}>{detail.status}</span>
          </div>

          {match ? (
            <>
              <div
                className={`rounded-lg border p-3 text-sm ${
                  match.status === 'PASS' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                3-Way Match: <span className="font-semibold">{match.status}</span> · toleransi qty {match.tolerance.qtyPct}% / harga {match.tolerance.pricePct}%
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-slate-50/75 font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Item</th>
                      <th className="px-3 py-2.5 text-right">Qty PO</th>
                      <th className="px-3 py-2.5 text-right">Qty GRN</th>
                      <th className="px-3 py-2.5 text-right">Qty Bill</th>
                      <th className="px-3 py-2.5 text-right">Δ Qty</th>
                      <th className="px-3 py-2.5 text-right">Harga PO</th>
                      <th className="px-3 py-2.5 text-right">Harga Bill</th>
                      <th className="px-3 py-2.5 text-right">Δ Harga</th>
                      <th className="px-3 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {match.lines.map((line, index) => (
                      <tr key={`${line.poLineId}-${index}`}>
                        <td className="px-3 py-2.5 text-slate-600">{line.itemId.slice(0, 8)}</td>
                        <td className="tabular px-3 py-2.5 text-right">{formatQty(line.qtyPo)}</td>
                        <td className="tabular px-3 py-2.5 text-right">{formatQty(line.qtyGrn)}</td>
                        <td className="tabular px-3 py-2.5 text-right">{formatQty(line.qtyBill)}</td>
                        <td className={`tabular px-3 py-2.5 text-right ${Number(line.qtyDiffPct) > Number(match.tolerance.qtyPct) ? 'font-bold text-rose-600' : 'text-slate-500'}`}>
                          {line.qtyDiffPct}%
                        </td>
                        <td className="tabular px-3 py-2.5 text-right">{formatMoney(line.pricePo)}</td>
                        <td className="tabular px-3 py-2.5 text-right">{formatMoney(line.priceBill)}</td>
                        <td className={`tabular px-3 py-2.5 text-right ${Number(line.priceDiffPct) > Number(match.tolerance.pricePct) ? 'font-bold text-rose-600' : 'text-slate-500'}`}>
                          {line.priceDiffPct}%
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={line.status === 'OK' ? 'text-emerald-600' : 'font-semibold text-amber-600'}>{line.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">Bill tanpa PO — 3-way matching tidak berlaku.</p>
          )}

          {detail.overrideReason ? (
            <p className="text-xs text-amber-700">Override: {detail.overrideReason}</p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            {detail.status === 'MATCH_EXCEPTION' ? (
              <>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Alasan override (min. 5 karakter)…"
                  className="field w-72 text-sm"
                />
                <button
                  type="button"
                  disabled={reason.length < 5 || overrideMutation.isPending}
                  onClick={() => overrideMutation.mutate()}
                  className="btn-secondary"
                >
                  {overrideMutation.isPending ? 'Memproses…' : 'Override'}
                </button>
              </>
            ) : null}
            {detail.status === 'MATCHED' ? (
              <button type="button" disabled={postMutation.isPending} onClick={() => postMutation.mutate()} className="btn-primary">
                {postMutation.isPending ? 'Memproses…' : 'Posting Tagihan'}
              </button>
            ) : null}
            <button type="button" onClick={() => setSelectedId(null)} className="btn-secondary">
              Tutup
            </button>
          </div>

          {overrideMutation.isError ? <p className="text-xs font-medium text-rose-600">{overrideMutation.error.message}</p> : null}
          {postMutation.isError ? <p className="text-xs font-medium text-rose-600">{postMutation.error.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
