import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { formatMoney, formatQty } from '../../shared/lib/format.ts';
import { createCreditNote, getInvoice, voidInvoice } from './sales.api.ts';

const STATUS_STYLE: Record<string, string> = {
  POSTED: 'bg-indigo-50 text-primary ring-1 ring-inset ring-primary/20',
  VOID: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
};

interface InvoiceModalProps {
  readonly invoiceId: string;
  readonly onClose: () => void;
}

export function InvoiceModal({ invoiceId, onClose }: InvoiceModalProps) {
  const queryClient = useQueryClient();
  const { data: detail } = useQuery({ queryKey: ['invoice', invoiceId], queryFn: () => getInvoice(invoiceId) });

  const [cnDate, setCnDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [showReturn, setShowReturn] = useState(false);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] }),
    ]);

  const voidMutation = useMutation({ mutationFn: () => voidInvoice(invoiceId), onSuccess: invalidate });

  const creditNoteMutation = useMutation({
    mutationFn: () => {
      const lines = (detail?.lines ?? [])
        .map((line) => ({ invoiceLineId: line.id, qty: returnQtys[line.id] ?? '' }))
        .filter((line) => line.qty !== '' && Number(line.qty) > 0);
      return createCreditNote(invoiceId, { cnDate, lines });
    },
    onSuccess: async () => {
      setReturnQtys({});
      setShowReturn(false);
      await invalidate();
    },
  });

  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between border-b border-border/80 pb-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text">{detail.docNumber}</h2>
            <p className="mt-1 text-xs text-muted">
              Subtotal {formatMoney(detail.subtotal)} · PPN {formatMoney(detail.tax)} · Total {formatMoney(detail.total)} · HPP {formatMoney(detail.cogs)}
            </p>
          </div>
          <span className={`badge ${STATUS_STYLE[detail.status] ?? 'bg-slate-100 text-slate-700'}`}>{detail.status}</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-slate-50/75 font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Harga</th>
                <th className="px-3 py-2.5 text-right">Jumlah</th>
                <th className="px-3 py-2.5 text-right">HPP/Unit</th>
                {showReturn ? <th className="px-3 py-2.5 text-right">Qty Retur</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {detail.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2.5 text-slate-600">{line.itemId.slice(0, 8)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{formatQty(line.qty)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{formatMoney(line.unitPrice)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{formatMoney(line.amount)}</td>
                  <td className="tabular px-3 py-2.5 text-right text-slate-500">{formatMoney(line.unitCost)}</td>
                  {showReturn ? (
                    <td className="px-3 py-2.5 text-right">
                      <input
                        value={returnQtys[line.id] ?? ''}
                        onChange={(e) => setReturnQtys((prev) => ({ ...prev, [line.id]: e.target.value }))}
                        placeholder="0"
                        className="field-mono w-20 text-right text-xs"
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showReturn ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="cnDate">Tanggal Nota Kredit</label>
              <input id="cnDate" type="date" value={cnDate} onChange={(e) => setCnDate(e.target.value)} className="field text-sm" />
            </div>
            <p className="text-xs text-muted">Retur memposting jurnal balik pendapatan & HPP (tanpa pengembalian stok fisik di P0).</p>
          </div>
        ) : null}

        {voidMutation.isError ? <p className="mt-3 text-xs font-medium text-rose-600">{voidMutation.error.message}</p> : null}
        {creditNoteMutation.isError ? <p className="mt-3 text-xs font-medium text-rose-600">{creditNoteMutation.error.message}</p> : null}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {detail.status === 'POSTED' ? (
            <>
              {showReturn ? (
                <>
                  <button type="button" onClick={() => setShowReturn(false)} className="btn-secondary">Batal</button>
                  <button
                    type="button"
                    disabled={creditNoteMutation.isPending || Object.values(returnQtys).every((q) => !q || Number(q) <= 0)}
                    onClick={() => creditNoteMutation.mutate()}
                    className="btn-primary"
                  >
                    {creditNoteMutation.isPending ? 'Memproses…' : 'Posting Nota Kredit'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setShowReturn(true)} className="btn-secondary">
                    Retur / Nota Kredit
                  </button>
                  <button
                    type="button"
                    disabled={voidMutation.isPending}
                    onClick={() => voidMutation.mutate()}
                    className="btn-secondary text-rose-600"
                  >
                    {voidMutation.isPending ? 'Memproses…' : 'Void Faktur'}
                  </button>
                </>
              )}
            </>
          ) : null}
          <button type="button" onClick={onClose} className="btn-secondary">Tutup</button>
        </div>
      </div>
    </div>
  );
}
