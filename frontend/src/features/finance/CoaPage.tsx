import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { createAccount, listAccounts } from './finance.api.ts';

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

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
      <h1 className="text-xl font-semibold">Chart of Accounts</h1>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-sm">
        <label className="flex flex-col text-sm text-muted">
          Kode
          <input value={code} onChange={(e) => setCode(e.target.value)} required className="mt-1 rounded-[var(--radius-base)] border border-border px-3 py-2 text-text" />
        </label>
        <label className="flex flex-col text-sm text-muted">
          Nama
          <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 rounded-[var(--radius-base)] border border-border px-3 py-2 text-text" />
        </label>
        <label className="flex flex-col text-sm text-muted">
          Tipe
          <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 rounded-[var(--radius-base)] border border-border px-3 py-2 text-text">
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={mutation.isPending} className="rounded-[var(--radius-base)] bg-primary px-4 py-2 text-primary-fg disabled:opacity-60">
          {mutation.isPending ? 'Menyimpan…' : 'Tambah Akun'}
        </button>
        {mutation.isError ? <span className="text-sm text-danger">{mutation.error.message}</span> : null}
      </form>

      {isLoading ? <p className="text-sm text-muted">Memuat…</p> : null}
      {error ? <p className="text-sm text-danger">{error.message}</p> : null}

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-muted">
            <tr>
              <th className="px-4 py-2">Kode</th>
              <th className="px-4 py-2">Nama</th>
              <th className="px-4 py-2">Tipe</th>
              <th className="px-4 py-2">Saldo Normal</th>
            </tr>
          </thead>
          <tbody>
            {(accounts ?? []).map((account) => (
              <tr key={account.id} className="border-t border-border">
                <td className="tabular px-4 py-2">{account.code}</td>
                <td className="px-4 py-2">{account.name}</td>
                <td className="px-4 py-2">{account.type}</td>
                <td className="px-4 py-2">{account.normalBalance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
