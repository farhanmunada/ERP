import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { IconUsers, IconPlus } from '../../shared/components/icons.tsx';
import { formatMoney } from '../../shared/lib/format.ts';
import { createCustomer, listCustomers } from './sales.api.ts';

export function CustomersPage() {
  const queryClient = useQueryClient();
  const { data: customers, isLoading, error } = useQuery({ queryKey: ['customers'], queryFn: listCustomers });

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [npwp, setNpwp] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [paymentTermDays, setPaymentTermDays] = useState('30');

  const mutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: async () => {
      setCode('');
      setName('');
      setEmail('');
      setPhone('');
      setNpwp('');
      setCreditLimit('0');
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
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
      creditLimit,
      paymentTermDays: Number(paymentTermDays),
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Master Customer"
        description="Daftar pelanggan dengan kontak, NPWP, credit limit, dan termin pembayaran."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {customers?.length ?? 0} Customer
          </span>
        }
      />

      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Tambah Customer</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="custCode">Kode</label>
            <input id="custCode" value={code} onChange={(e) => setCode(e.target.value)} required className="field-mono text-sm" placeholder="CUST-001" />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="custName">Nama</label>
            <input id="custName" value={name} onChange={(e) => setName(e.target.value)} required className="field text-sm" placeholder="Toko Berkah Jaya" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="custEmail">Email</label>
            <input id="custEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field text-sm" placeholder="order@toko.id" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="custPhone">Telepon</label>
            <input id="custPhone" value={phone} onChange={(e) => setPhone(e.target.value)} className="field text-sm" placeholder="021-5550101" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="custNpwp">NPWP</label>
            <input id="custNpwp" value={npwp} onChange={(e) => setNpwp(e.target.value)} className="field text-sm" placeholder="00.000.000.0-000.000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="custCredit">Credit Limit (IDR)</label>
            <input id="custCredit" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className="field-mono text-sm" placeholder="5000000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="custTerm">Termin (hari)</label>
            <input id="custTerm" value={paymentTermDays} onChange={(e) => setPaymentTermDays(e.target.value)} className="field-mono text-sm" placeholder="30" />
          </div>

          <div className="sm:col-span-4 flex items-center justify-between pt-1">
            {mutation.isError ? <span className="text-xs font-medium text-rose-600">{mutation.error.message}</span> : <span />}
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Menyimpan…' : 'Simpan Customer'}
            </button>
          </div>
        </form>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div> : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Kode</th>
              <th className="px-5 py-3.5">Nama</th>
              <th className="px-5 py-3.5">Kontak</th>
              <th className="px-5 py-3.5 text-right">Credit Limit</th>
              <th className="px-5 py-3.5 text-right">Termin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(customers ?? []).map((customer) => (
              <tr key={customer.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">{customer.code}</td>
                <td className="px-5 py-4 font-medium text-slate-800">{customer.name}</td>
                <td className="px-5 py-4 text-xs text-slate-500">{customer.email ?? customer.phone ?? '—'}</td>
                <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-700">{formatMoney(customer.creditLimit)}</td>
                <td className="tabular px-5 py-4 text-right font-mono text-xs text-slate-500">{customer.paymentTermDays} hari</td>
              </tr>
            ))}
            {(customers ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted">
                  <IconUsers className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Customer</p>
                  <p className="text-xs text-slate-400 mt-1">Tambahkan pelanggan untuk memulai alur penjualan.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
