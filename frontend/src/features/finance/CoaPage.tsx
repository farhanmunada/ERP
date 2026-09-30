import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { createAccount, listAccounts } from './finance.api.ts';
import { IconBook, IconPlus } from '../../shared/components/icons.tsx';

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

const TYPE_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  ASSET: { label: 'Aset', badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  LIABILITY: { label: 'Liabilitas', badgeClass: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  EQUITY: { label: 'Ekuitas', badgeClass: 'bg-purple-50 text-purple-700 ring-purple-600/20' },
  REVENUE: { label: 'Pendapatan', badgeClass: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  EXPENSE: { label: 'Beban', badgeClass: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
};

export function CoaPage() {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading, error } = useQuery({ queryKey: ['coa'], queryFn: listAccounts });

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('ASSET');

  const mutation = useMutation({
    mutationFn: createAccount,
    onSuccess: async () => {
      setCode('');
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['coa'] });
    },
  });

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    mutation.mutate({ code, name, type });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bagan Akun (Chart of Accounts)"
        description="Daftar hierarki akun buku besar untuk pencatatan transaksi finansial."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {accounts?.length ?? 0} Akun Terdaftar
          </span>
        }
      />

      {/* Form Tambah Akun Baru */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <IconPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-text">Tambah Akun Baru</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="accountCode">
              Kode Akun
            </label>
            <input
              id="accountCode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="field font-mono text-sm"
              placeholder="Contoh: 1101"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="accountName">
              Nama Akun
            </label>
            <input
              id="accountName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="field text-sm"
              placeholder="Contoh: Kas Utama Operasional"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="accountType">
              Klasifikasi Tipe
            </label>
            <select
              id="accountType"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="field text-sm"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_CONFIG[t]?.label ?? t}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4 flex items-center justify-between pt-2">
            {mutation.isError ? (
              <span className="text-xs font-medium text-rose-600">{mutation.error.message}</span>
            ) : <span />}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary"
            >
              {mutation.isPending ? 'Menyimpan…' : 'Simpan Akun Baru'}
            </button>
          </div>
        </form>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted">Memuat data akun…</div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error.message}
        </div>
      ) : null}

      {/* Tabel Akun */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3.5">Kode Akun</th>
              <th className="px-6 py-3.5">Nama Akun</th>
              <th className="px-6 py-3.5">Tipe Klasifikasi</th>
              <th className="px-6 py-3.5">Saldo Normal</th>
              <th className="px-6 py-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(accounts ?? []).map((account) => {
              const typeMeta = TYPE_CONFIG[account.type] ?? {
                label: account.type,
                badgeClass: 'bg-slate-50 text-slate-700 ring-slate-600/20',
              };

              return (
                <tr key={account.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="tabular px-6 py-4 font-mono text-xs font-bold text-slate-900">
                    <span className="rounded bg-slate-100 px-2 py-1 text-slate-800">
                      {account.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{account.name}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ring-1 ring-inset ${typeMeta.badgeClass}`}>
                      {typeMeta.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">
                    {account.normalBalance}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Aktif
                    </span>
                  </td>
                </tr>
              );
            })}

            {(accounts ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted">
                  <IconBook className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Belum Ada Bagan Akun</p>
                  <p className="text-xs text-slate-400 mt-1">Gunakan formulir di atas untuk mendaftarkan akun pertama.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
