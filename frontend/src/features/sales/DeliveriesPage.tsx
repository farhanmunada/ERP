import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconTruck } from '../../shared/components/icons.tsx';
import { formatQty } from '../../shared/lib/format.ts';
import { getSalesOrder, listDeliveries, listSalesOrders, createDelivery } from './sales.api.ts';

const DELIVERABLE = new Set(['CONFIRMED', 'PARTIALLY_DELIVERED']);

export function DeliveriesPage() {
  const queryClient = useQueryClient();
  const { data: deliveries, isLoading, error } = useQuery({ queryKey: ['deliveries'], queryFn: listDeliveries });
  const { data: orders } = useQuery({ queryKey: ['salesOrders'], queryFn: listSalesOrders });

  const [soId, setSoId] = useState('');
  const [doDate, setDoDate] = useState(new Date().toISOString().slice(0, 10));
  const [qtys, setQtys] = useState<Record<string, string>>({});

  const deliverableOrders = useMemo(() => (orders ?? []).filter((so) => DELIVERABLE.has(so.status)), [orders]);

  const { data: soDetail } = useQuery({
    queryKey: ['salesOrder', soId],
    queryFn: () => getSalesOrder(soId),
    enabled: Boolean(soId),
  });

  const mutation = useMutation({
    mutationFn: createDelivery,
    onSuccess: async () => {
      setQtys({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['deliveries'] }),
        queryClient.invalidateQueries({ queryKey: ['salesOrders'] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]);
    },
  });

  function handleSubmit(): void {
    if (!soDetail) return;
    const lines = soDetail.lines
      .map((line) => ({ soLineId: line.id, qtyDelivered: qtys[line.id] ?? '' }))
      .filter((line) => line.qtyDelivered !== '' && Number(line.qtyDelivered) > 0);
    if (lines.length === 0) return;
    mutation.mutate({ soId, doDate, lines });
  }

  const remaining = (qty: string, delivered: string) => (Number(qty) - Number(delivered)).toFixed(4);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Delivery Order"
        description="Kirim barang terhadap SO yang dikonfirmasi. Reserve dilepas dan stok berkurang; HPP dihitung dari costing engine."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {deliveries?.length ?? 0} DO
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconTruck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Kirim Barang</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="doSo">Sales Order</label>
            <select
              id="doSo"
              value={soId}
              onChange={(e) => {
                setSoId(e.target.value);
                setQtys({});
              }}
              className="field text-sm"
            >
              <option value="">Pilih SO…</option>
              {deliverableOrders.map((so) => (
                <option key={so.id} value={so.id}>{so.docNumber} — {so.customerName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="doDate">Tanggal</label>
            <input id="doDate" type="date" value={doDate} onChange={(e) => setDoDate(e.target.value)} className="field text-sm" />
          </div>
        </div>

        {soDetail ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5 text-right">Qty SO</th>
                  <th className="px-4 py-2.5 text-right">Terkirim</th>
                  <th className="px-4 py-2.5 text-right">Sisa</th>
                  <th className="px-4 py-2.5 text-right">Qty Kirim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {soDetail.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{line.itemId.slice(0, 8)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono text-xs">{formatQty(line.qty)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono text-xs text-slate-500">{formatQty(line.deliveredQty)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono text-xs font-semibold text-primary">{remaining(line.qty, line.deliveredQty)}</td>
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
          <button type="button" disabled={!soId || mutation.isPending} onClick={handleSubmit} className="btn-primary">
            {mutation.isPending ? 'Memproses…' : 'Posting Pengiriman'}
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
              <th className="px-5 py-3.5">Sales Order</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(deliveries ?? []).map((delivery) => (
              <tr key={delivery.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">{delivery.docNumber}</td>
                <td className="px-5 py-4 text-slate-600">{delivery.doDate}</td>
                <td className="px-5 py-4 font-mono text-xs text-slate-500">{delivery.soDocNumber}</td>
                <td className="px-5 py-4">
                  <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">{delivery.status}</span>
                </td>
              </tr>
            ))}
            {(deliveries ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-muted">
                  <IconTruck className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Pengiriman</p>
                  <p className="text-xs text-slate-400 mt-1">Kirim barang terhadap SO yang sudah dikonfirmasi.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
