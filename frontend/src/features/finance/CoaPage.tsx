import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { createAccount, listAccounts } from './finance.api.ts';

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

const TYPE_LABELS: Record<string, string> = {
  ASSET: 'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
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
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Bagan Akun"
        description="Struktur akun buku besar perusahaan."
        actions={<span className="font-mono text-xs text-muted">{accounts?.length ?? 0} akun</span>}
      />

      <form onSubmit={handleSubmit} className="panel flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Kode
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="field font-mono w-28"
            placeholder="1-1000"
          />
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-sm font-medium">
          Nama Akun
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="field"
            placeholder="Kas"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tipe
          <select value={type} onChange={(e) => setType(e.target.value)} className="field">
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Menyimpan…' : 'Tambah Akun'}
        </button>
        {mutation.isError ? (
          <span className="text-sm text-danger">{mutation.error.message}</span>
        ) : null}
      </form>

      {isLoading ? <p className="text-sm text-muted">Memuat…</p> : null}
      {error ? <p className="text-sm text-danger">{error.message}</p> : null}

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-5 py-3 font-mono">KODE</th>
              <th className="px-5 py-3">NAMA</th>
              <th className="px-5 py-3">TIPE</th>
              <th className="px-5 py-3">SALDO NORMAL</th>
            </tr>
          </thead>
          <tbody>
            {(accounts ?? []).map((account) => (
              <tr key={account.id} className="border-b border-border last:border-0 hover:bg-canvas">
                <td className="tabular px-5 py-3 font-mono text-xs">{account.code}</td>
                <td className="px-5 py-3">{account.name}</td>
                <td className="px-5 py-3 text-muted">{TYPE_LABELS[account.type] ?? account.type}</td>
                <td className="px-5 py-3 text-muted">{account.normalBalance}</td>
              </tr>
            ))}
            {(accounts ?? []).length === 0 && !isLoading ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted">
                  Belum ada akun. Tambahkan akun pertama Anda di atas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
