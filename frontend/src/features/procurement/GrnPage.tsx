import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconReceipt } from '../../shared/components/icons.tsx';
import { formatMoney, formatQty } from '../../shared/lib/format.ts';
import { listWarehouses } from '../inventory/inventory.api.ts';
import { createGrn, getPo, listGrns, listPos } from './procurement.api.ts';

const RECEIVABLE = new Set(['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED']);

export function GrnPage() {
  const queryClient = useQueryClient();
  const { data: grns, isLoading, error } = useQuery({ queryKey: ['grns'], queryFn: listGrns });
  const { data: pos } = useQuery({ queryKey: ['pos'], queryFn: listPos });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });

  const [poId, setPoId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [grnDate, setGrnDate] = useState(new Date().toISOString().slice(0, 10));
  const [qtys, setQtys] = useState<Record<string, string>>({});

  const openPos = useMemo(() => (pos ?? []).filter((po) => RECEIVABLE.has(po.status)), [pos]);

  const { data: poDetail } = useQuery({
    queryKey: ['po', poId],
    queryFn: () => getPo(poId),
    enabled: Boolean(poId),
  });

  const mutation = useMutation({
    mutationFn: createGrn,
    onSuccess: async () => {
      setQtys({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['grns'] }),
        queryClient.invalidateQueries({ queryKey: ['pos'] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]);
    },
  });

  function handleSubmit(): void {
    if (!poDetail) return;
    const lines = poDetail.lines
      .map((line) => ({ poLineId: line.id, qtyReceived: qtys[line.id] ?? '' }))
      .filter((line) => line.qtyReceived !== '' && Number(line.qtyReceived) > 0);
    if (lines.length === 0) return;
    mutation.mutate({ poId, warehouseId, grnDate, lines });
  }

  const remaining = (qty: string, received: string) => (Number(qty) - Number(received)).toFixed(4);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Penerimaan Barang (GRN)"
        description="Catat penerimaan barang terhadap PO. Stok bertambah dan jurnal Debit Persediaan / Credit GRN Accrual dibuat otomatis."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {grns?.length ?? 0} GRN
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconReceipt className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Terima Barang</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="grnPo">Purchase Order</label>
            <select
              id="grnPo"
              value={poId}
              onChange={(e) => {
                setPoId(e.target.value);
                setQtys({});
              }}
              className="field text-sm"
            >
              <option value="">Pilih PO…</option>
              {openPos.map((po) => (
                <option key={po.id} value={po.id}>{po.docNumber} — {po.vendorName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="grnWh">Gudang</label>
            <select id="grnWh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="field text-sm">
              <option value="">Pilih gudang…</option>
              {(warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="grnDate">Tanggal</label>
            <input id="grnDate" type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} className="field text-sm" />
          </div>
        </div>

        {poDetail ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5 text-right">Qty PO</th>
                  <th className="px-4 py-2.5 text-right">Diterima</th>
                  <th className="px-4 py-2.5 text-right">Sisa</th>
                  <th className="px-4 py-2.5 text-right">Harga</th>
                  <th className="px-4 py-2.5 text-right">Qty Terima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {poDetail.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{line.itemId.slice(0, 8)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono text-xs">{formatQty(line.qty)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono text-xs text-slate-500">{formatQty(line.receivedQty)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono text-xs font-semibold text-primary">{remaining(line.qty, line.receivedQty)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono text-xs text-slate-500">{formatMoney(line.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        value={qtys[line.id] ?? ''}
                        onChange={(e) => setQtys((prev) => ({ ...prev, [line.id]: e.target.value }))}
                        placeholder="0"
                        className="field-mono w-24 text-right text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          {mutation.isError ? <span className="text-xs font-medium text-rose-600">{mutation.error.message}</span> : <span />}
          <button type="button" disabled={!poId || !warehouseId || mutation.isPending} onClick={handleSubmit} className="btn-primary">
            {mutation.isPending ? 'Memproses…' : 'Posting Penerimaan'}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div> : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">No. Dokumen</th>
              <th className="px-5 py-3.5">Tanggal</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Jurnal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(grns ?? []).map((grn) => (
              <tr key={grn.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">{grn.docNumber}</td>
                <td className="px-5 py-4 text-slate-600">{grn.grnDate}</td>
                <td className="px-5 py-4">
                  <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">{grn.status}</span>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-slate-500">{grn.journalEntryId ? grn.journalEntryId.slice(0, 8) : '—'}</td>
              </tr>
            ))}
            {(grns ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-muted">
                  <IconReceipt className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Penerimaan</p>
                  <p className="text-xs text-slate-400 mt-1">Terima barang terhadap PO yang sudah disetujui.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
