import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { formatMoney } from '../../shared/lib/format.ts';
import { createBill, getPo, overrideBill, postBill } from './procurement.api.ts';
import type { MatchResult } from './procurement.api.ts';

interface BillModalProps {
  readonly poId: string;
  readonly onClose: () => void;
  readonly onCreated: () => void | Promise<void>;
}

interface DraftLine {
  readonly poLineId: string;
  readonly itemId: string;
  qty: string;
  unitPrice: string;
}

// Modal to create a vendor bill from a PO, then override (if needed) and post it.
export function BillModal({ poId, onClose, onCreated }: BillModalProps) {
  const queryClient = useQueryClient();
  const { data: po } = useQuery({ queryKey: ['po', poId], queryFn: () => getPo(poId) });

  const [billDate] = useState(new Date().toISOString().slice(0, 10));
  const [tax, setTax] = useState('0');
  const [overrides, setOverrides] = useState<Record<string, { qty?: string; unitPrice?: string }>>({});
  const [billId, setBillId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [reason, setReason] = useState('');

  const lines = useMemo<DraftLine[]>(
    () =>
      (po?.lines ?? []).map((line) => ({
        poLineId: line.id,
        itemId: line.itemId,
        qty: overrides[line.id]?.qty ?? line.receivedQty,
        unitPrice: overrides[line.id]?.unitPrice ?? line.unitPrice,
      })),
    [po, overrides],
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createBill({
        billDate,
        vendorId: po?.vendorId ?? '',
        poId,
        tax,
        lines: lines.map((line) => ({ poLineId: line.poLineId, itemId: line.itemId, qty: line.qty, unitPrice: line.unitPrice })),
      }),
    onSuccess: (result) => {
      setBillId(result.id);
      setMatch(result.match);
    },
  });

  const overrideMutation = useMutation({
    mutationFn: () => overrideBill(billId ?? '', reason),
    onSuccess: () => setMatch((prev) => (prev ? { ...prev, status: 'PASS' } : prev)),
  });

  const postMutation = useMutation({
    mutationFn: () => postBill(billId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bills'] });
      await onCreated();
    },
  });

  const isPosted = postMutation.isSuccess;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold tracking-tight text-text">Buat Tagihan Vendor</h2>
        <p className="mt-1 text-sm text-muted">Sesuaikan qty/harga jika berbeda dari PO; sistem melakukan 3-way matching otomatis.</p>

        <div className="mt-4 max-h-[40vh] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5 text-right">Qty Diterima</th>
                <th className="px-4 py-2.5 text-right">Qty Tagihan</th>
                <th className="px-4 py-2.5 text-right">Harga PO</th>
                <th className="px-4 py-2.5 text-right">Harga Tagihan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(po?.lines ?? []).map((line) => {
                const draft = lines.find((l) => l.poLineId === line.id);
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{line.itemId.slice(0, 8)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono text-xs text-slate-500">{line.receivedQty}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        value={draft?.qty ?? ''}
                        onChange={(e) => setOverrides((prev) => ({ ...prev, [line.id]: { ...prev[line.id], qty: e.target.value } }))}
                        className="field-mono w-24 text-right text-xs"
                      />
                    </td>
                    <td className="tabular px-4 py-2.5 text-right font-mono text-xs text-slate-500">{formatMoney(line.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        value={draft?.unitPrice ?? ''}
                        onChange={(e) => setOverrides((prev) => ({ ...prev, [line.id]: { ...prev[line.id], unitPrice: e.target.value } }))}
                        className="field-mono w-28 text-right text-xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-700" htmlFor="billTax">PPN</label>
          <input id="billTax" value={tax} onChange={(e) => setTax(e.target.value)} className="field-mono w-32 text-sm" />
          <span className="text-xs text-muted">Nilai pajak masukan (opsional).</span>
        </div>

        {match ? (
          <div className="mt-4 space-y-2">
            <div className={`rounded-lg border p-3 text-sm ${match.status === 'PASS' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              3-Way Match: <span className="font-semibold">{match.status === 'PASS' ? 'PASS' : 'MATCH_EXCEPTION'}</span> (toleransi qty {match.tolerance.qtyPct}% · harga {match.tolerance.pricePct}%)
            </div>
            {match.status === 'EXCEPTION' ? (
              <div className="flex items-center gap-2">
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan override…" className="field flex-1 text-sm" />
                <button type="button" disabled={reason.length < 5 || overrideMutation.isPending} onClick={() => overrideMutation.mutate()} className="btn-secondary">
                  Override
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {createMutation.isError ? <p className="mt-3 text-xs font-medium text-rose-600">{createMutation.error.message}</p> : null}
        {postMutation.isError ? <p className="mt-3 text-xs font-medium text-rose-600">{postMutation.error.message}</p> : null}
        {isPosted ? <p className="mt-3 text-sm font-medium text-emerald-700">Tagihan berhasil diposting.</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Tutup</button>
          {!billId ? (
            <button type="button" disabled={createMutation.isPending || !po} onClick={() => createMutation.mutate()} className="btn-primary">
              {createMutation.isPending ? 'Memproses…' : 'Buat & Cek Match'}
            </button>
          ) : (
            <button
              type="button"
              disabled={match?.status !== 'PASS' || postMutation.isPending || isPosted}
              onClick={() => postMutation.mutate()}
              className="btn-primary"
            >
              {postMutation.isPending ? 'Memproses…' : 'Posting Tagihan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
