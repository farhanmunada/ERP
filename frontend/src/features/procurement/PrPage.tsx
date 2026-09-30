import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconClipboard, IconPlus } from '../../shared/components/icons.tsx';
import { formatQty } from '../../shared/lib/format.ts';
import { listItems, listWarehouses } from '../inventory/inventory.api.ts';
import { approvePr, convertPrToPo, createPr, getPr, listPrs, listVendors } from './procurement.api.ts';
import type { PrLine } from './procurement.api.ts';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Disetujui',
  CONVERTED: 'Dikonversi',
};

export function PrPage() {
  const queryClient = useQueryClient();
  const { data: prs, isLoading, error } = useQuery({ queryKey: ['prs'], queryFn: listPrs });
  const { data: items } = useQuery({ queryKey: ['items'], queryFn: listItems });
  const { data: vendors } = useQuery({ queryKey: ['vendors'], queryFn: listVendors });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });

  const [prDate, setPrDate] = useState(new Date().toISOString().slice(0, 10));
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');

  // Convert dialog state
  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertLines, setConvertLines] = useState<readonly PrLine[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['prs'] });

  const createMutation = useMutation({
    mutationFn: createPr,
    onSuccess: async () => {
      setItemId('');
      setQty('');
      await invalidate();
    },
  });

  const approveMutation = useMutation({ mutationFn: approvePr, onSuccess: invalidate });

  const convertMutation = useMutation({
    mutationFn: (payload: { prId: string; vendorId: string; warehouseId: string; unitPrice: string; lines: readonly PrLine[] }) =>
      convertPrToPo(payload.prId, {
        vendorId: payload.vendorId,
        warehouseId: payload.warehouseId,
        poDate: new Date().toISOString().slice(0, 10),
        tax: '0',
        lines: payload.lines.map((line) => ({ itemId: line.itemId, qty: line.qty, unitPrice: payload.unitPrice })),
      }),
    onSuccess: async () => {
      setConvertId(null);
      setVendorId('');
      setWarehouseId('');
      setUnitPrice('');
      await Promise.all([invalidate(), queryClient.invalidateQueries({ queryKey: ['pos'] })]);
    },
  });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    createMutation.mutate({ prDate, lines: [{ itemId, qty }] });
  }

  async function openConvert(prId: string): Promise<void> {
    const detail = await getPr(prId);
    setConvertLines(detail.lines);
    setConvertId(prId);
    setVendorId('');
    setWarehouseId('');
    setUnitPrice('');
  }

  const itemLabel = (id: string) => {
    const item = items?.find((i) => i.id === id);
    return item ? `${item.code} — ${item.name}` : id;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Purchase Requisition"
        description="Permintaan pembelian internal; setelah disetujui dapat dikonversi menjadi Purchase Order."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {prs?.length ?? 0} PR
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Buat PR Baru</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="prDate">Tanggal</label>
            <input id="prDate" type="date" value={prDate} onChange={(e) => setPrDate(e.target.value)} required className="field text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="prItem">Item</label>
            <select id="prItem" value={itemId} onChange={(e) => setItemId(e.target.value)} required className="field text-sm">
              <option value="">Pilih item…</option>
              {(items ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.code} — {item.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="prQty">Kuantitas</label>
            <input id="prQty" value={qty} onChange={(e) => setQty(e.target.value)} required className="field-mono text-sm" placeholder="0" />
          </div>

          <div className="sm:col-span-4 flex items-center justify-between pt-1">
            {createMutation.isError ? <span className="text-xs font-medium text-rose-600">{createMutation.error.message}</span> : <span />}
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan PR'}
            </button>
          </div>
        </form>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div> : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">No. Dokumen</th>
              <th className="px-5 py-3.5">Tanggal</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(prs ?? []).map((pr) => (
              <tr key={pr.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">{pr.docNumber}</td>
                <td className="px-5 py-4 text-slate-600">{pr.prDate}</td>
                <td className="px-5 py-4">
                  <span className={pr.status === 'DRAFT' ? 'badge bg-slate-100 text-slate-700' : 'badge bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'}>
                    {STATUS_LABEL[pr.status] ?? pr.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  {pr.status === 'DRAFT' ? (
                    <button type="button" onClick={() => approveMutation.mutate(pr.id)} disabled={approveMutation.isPending} className="btn-secondary px-3 py-1.5 text-xs">
                      Setujui
                    </button>
                  ) : pr.status === 'APPROVED' ? (
                    <button type="button" onClick={() => void openConvert(pr.id)} className="btn-secondary px-3 py-1.5 text-xs">
                      Konversi ke PO
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {(prs ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-muted">
                  <IconClipboard className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada PR</p>
                  <p className="text-xs text-slate-400 mt-1">Buat permintaan pembelian untuk memulai alur pengadaan.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {convertId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-lg">
            <h2 className="text-lg font-bold tracking-tight text-text">Konversi PR → Purchase Order</h2>
            <p className="mt-1 text-sm text-muted">Pilih vendor, gudang tujuan, dan harga satuan untuk seluruh baris PR.</p>

            <div className="mt-4 space-y-2 rounded-lg border border-border bg-slate-50/60 p-3 text-xs">
              {convertLines.map((line) => (
                <div key={line.id} className="flex justify-between text-slate-600">
                  <span>{itemLabel(line.itemId)}</span>
                  <span className="tabular font-mono">{formatQty(line.qty)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="cvVendor">Vendor</label>
                <select id="cvVendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="field text-sm">
                  <option value="">Pilih vendor…</option>
                  {(vendors ?? []).map((v) => <option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="cvWh">Gudang Tujuan</label>
                <select id="cvWh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="field text-sm">
                  <option value="">Pilih gudang…</option>
                  {(warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="cvPrice">Harga Satuan</label>
                <input id="cvPrice" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="field-mono text-sm" placeholder="10000" />
              </div>
              {convertMutation.isError ? <p className="text-xs font-medium text-rose-600">{convertMutation.error.message}</p> : null}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConvertId(null)} className="btn-secondary">Batal</button>
              <button
                type="button"
                disabled={!vendorId || !warehouseId || !unitPrice || convertMutation.isPending}
                onClick={() => convertMutation.mutate({ prId: convertId, vendorId, warehouseId, unitPrice, lines: convertLines })}
                className="btn-primary"
              >
                {convertMutation.isPending ? 'Memproses…' : 'Buat PO'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
