import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconTruck, IconPlus } from '../../shared/components/icons.tsx';
import { formatMoney } from '../../shared/lib/format.ts';
import { listItems, listWarehouses } from '../inventory/inventory.api.ts';
import { approvePo, createPo, listPos, listVendors, rejectPo, submitPo } from './procurement.api.ts';
import { BillModal } from './BillModal.tsx';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
  PENDING_APPROVAL: { label: 'Menunggu Approval', className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' },
  APPROVED: { label: 'Disetujui', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' },
  REJECTED: { label: 'Ditolak', className: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20' },
  PARTIALLY_RECEIVED: { label: 'Diterima Sebagian', className: 'bg-indigo-50 text-primary ring-1 ring-inset ring-primary/20' },
  RECEIVED: { label: 'Diterima', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' },
  CLOSED: { label: 'Ditutup', className: 'bg-slate-100 text-slate-700' },
};

export function PoPage() {
  const queryClient = useQueryClient();
  const { data: pos, isLoading, error } = useQuery({ queryKey: ['pos'], queryFn: listPos });
  const { data: items } = useQuery({ queryKey: ['items'], queryFn: listItems });
  const { data: vendors } = useQuery({ queryKey: ['vendors'], queryFn: listVendors });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });

  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [tax, setTax] = useState('0');

  const [billPoId, setBillPoId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pos'] });

  const createMutation = useMutation({
    mutationFn: createPo,
    onSuccess: async () => {
      setItemId('');
      setQty('');
      setUnitPrice('');
      await invalidate();
    },
  });

  const submitMutation = useMutation({ mutationFn: submitPo, onSuccess: invalidate });
  const approveMutation = useMutation({ mutationFn: approvePo, onSuccess: invalidate });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectPo(id, 'Ditolak dari daftar PO'),
    onSuccess: invalidate,
  });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    createMutation.mutate({ poDate, vendorId, warehouseId, tax, lines: [{ itemId, qty, unitPrice }] });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Purchase Order"
        description="Pesanan pembelian ke vendor dengan alur persetujuan berjenjang berdasarkan nominal."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {pos?.length ?? 0} PO
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Buat PO Baru</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-6 sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="poDate">Tanggal</label>
            <input id="poDate" type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} required className="field text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="poVendor">Vendor</label>
            <select id="poVendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required className="field text-sm">
              <option value="">Pilih vendor…</option>
              {(vendors ?? []).map((v) => <option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="poWh">Gudang</label>
            <select id="poWh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className="field text-sm">
              <option value="">Pilih…</option>
              {(warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="poItem">Item</label>
            <select id="poItem" value={itemId} onChange={(e) => setItemId(e.target.value)} required className="field text-sm">
              <option value="">Pilih item…</option>
              {(items ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="poQty">Qty</label>
            <input id="poQty" value={qty} onChange={(e) => setQty(e.target.value)} required className="field-mono text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="poPrice">Harga</label>
            <input id="poPrice" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required className="field-mono text-sm" placeholder="10000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="poTax">Pajak</label>
            <input id="poTax" value={tax} onChange={(e) => setTax(e.target.value)} className="field-mono text-sm" />
          </div>
          <div className="sm:col-span-6 flex items-center justify-between pt-1">
            {createMutation.isError ? <span className="text-xs font-medium text-rose-600">{createMutation.error.message}</span> : <span />}
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan PO'}
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
              <th className="px-5 py-3.5">Vendor</th>
              <th className="px-5 py-3.5">Tanggal</th>
              <th className="px-5 py-3.5 text-right">Total</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(pos ?? []).map((po) => {
              const status = STATUS_LABEL[po.status] ?? { label: po.status, className: 'bg-slate-100 text-slate-700' };
              return (
                <tr key={po.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">{po.docNumber}</td>
                  <td className="px-5 py-4 text-slate-700">{po.vendorName}</td>
                  <td className="px-5 py-4 text-slate-600">{po.poDate}</td>
                  <td className="tabular px-5 py-4 text-right font-mono text-xs font-semibold text-slate-900">{formatMoney(po.total)}</td>
                  <td className="px-5 py-4">
                    <span className={`badge ${status.className}`}>{status.label}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      {po.status === 'DRAFT' ? (
                        <button type="button" onClick={() => submitMutation.mutate(po.id)} disabled={submitMutation.isPending} className="btn-secondary px-3 py-1.5 text-xs">
                          Submit
                        </button>
                      ) : null}
                      {po.status === 'PENDING_APPROVAL' ? (
                        <>
                          <button type="button" onClick={() => approveMutation.mutate(po.id)} disabled={approveMutation.isPending} className="btn-secondary px-3 py-1.5 text-xs">
                            Approve
                          </button>
                          <button type="button" onClick={() => rejectMutation.mutate(po.id)} disabled={rejectMutation.isPending} className="btn-secondary px-3 py-1.5 text-xs">
                            Reject
                          </button>
                        </>
                      ) : null}
                      {po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED' || po.status === 'RECEIVED' ? (
                        <button type="button" onClick={() => setBillPoId(po.id)} className="btn-secondary px-3 py-1.5 text-xs">
                          Buat Tagihan
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {(pos ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted">
                  <IconTruck className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada PO</p>
                  <p className="text-xs text-slate-400 mt-1">Buat PO langsung atau konversi dari PR yang disetujui.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {billPoId ? (
        <BillModal
          poId={billPoId}
          onClose={() => setBillPoId(null)}
          onCreated={async () => {
            setBillPoId(null);
            await queryClient.invalidateQueries({ queryKey: ['bills'] });
          }}
        />
      ) : null}
    </div>
  );
}
