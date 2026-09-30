import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconStore, IconPlus } from '../../shared/components/icons.tsx';
import { createVendor, listVendors } from './procurement.api.ts';

export function VendorsPage() {
  const queryClient = useQueryClient();
  const { data: vendors, isLoading, error } = useQuery({ queryKey: ['vendors'], queryFn: listVendors });

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [npwp, setNpwp] = useState('');
  const [paymentTermDays, setPaymentTermDays] = useState('30');

  const mutation = useMutation({
    mutationFn: createVendor,
    onSuccess: async () => {
      setCode('');
      setName('');
      setEmail('');
      setPhone('');
      setNpwp('');
      await queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    mutation.mutate({
      code,
      name,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(npwp ? { npwp } : {}),
      paymentTermDays: Number(paymentTermDays),
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Master Vendor"
        description="Daftar pemasok dengan kontak, NPWP, dan termin pembayaran."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {vendors?.length ?? 0} Vendor
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Tambah Vendor Baru</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-6 sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="vCode">Kode</label>
            <input id="vCode" value={code} onChange={(e) => setCode(e.target.value)} required className="field font-mono text-sm" placeholder="VND-003" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="vName">Nama Vendor</label>
            <input id="vName" value={name} onChange={(e) => setName(e.target.value)} required className="field text-sm" placeholder="PT Pemasok Sejahtera" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="vEmail">Email</label>
            <input id="vEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field text-sm" placeholder="sales@vendor.id" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="vPhone">Telepon</label>
            <input id="vPhone" value={phone} onChange={(e) => setPhone(e.target.value)} className="field text-sm" placeholder="021-5550000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="vTerm">Termin (hari)</label>
            <input id="vTerm" type="number" value={paymentTermDays} onChange={(e) => setPaymentTermDays(e.target.value)} className="field-mono text-sm" />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="vNpwp">NPWP</label>
            <input id="vNpwp" value={npwp} onChange={(e) => setNpwp(e.target.value)} className="field-mono text-sm" placeholder="00.000.000.0-000.000" />
          </div>

          <div className="sm:col-span-6 flex items-center justify-between pt-1">
            {mutation.isError ? <span className="text-xs font-medium text-rose-600">{mutation.error.message}</span> : <span />}
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Menyimpan…' : 'Simpan Vendor'}
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
              <th className="px-6 py-3.5">Kontak</th>
              <th className="px-6 py-3.5">NPWP</th>
              <th className="px-6 py-3.5 text-right">Termin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(vendors ?? []).map((vendor) => (
              <tr key={vendor.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">
                  <span className="rounded bg-slate-100 px-2 py-1 text-slate-800">{vendor.code}</span>
                </td>
                <td className="px-6 py-4 font-medium text-slate-900">{vendor.name}</td>
                <td className="px-6 py-4 text-xs text-slate-600">
                  <p>{vendor.email ?? '—'}</p>
                  <p className="text-slate-400">{vendor.phone ?? '—'}</p>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-slate-600">{vendor.npwp ?? '—'}</td>
                <td className="tabular px-6 py-4 text-right font-mono text-xs text-slate-600">{vendor.paymentTermDays} hari</td>
              </tr>
            ))}
            {(vendors ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted">
                  <IconStore className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Vendor</p>
                  <p className="text-xs text-slate-400 mt-1">Gunakan formulir di atas untuk menambahkan vendor pertama.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
