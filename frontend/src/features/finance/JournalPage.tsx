import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { createJournal, listAccounts } from './finance.api.ts';
import type { JournalLinePayload } from './finance.api.ts';

interface DraftLine {
  accountId: string;
  debit: string;
  credit: string;
}

const EMPTY_LINE: DraftLine = { accountId: '', debit: '0.00', credit: '0.00' };

export function JournalPage() {
  const queryClient = useQueryClient();
  const { data: accounts } = useQuery({ queryKey: ['coa'], queryFn: listAccounts });

  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: { lines: readonly JournalLinePayload[]; idempotencyKey: string }) =>
      createJournal({ entryDate, description, lines: payload.lines }, payload.idempotencyKey),
    onSuccess: async () => {
      setNotice('Jurnal berhasil diposting.');
      setDescription('');
      setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
      await queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
    },
    onError: (error: Error) => setNotice(error.message),
  });

  function updateLine(index: number, patch: Partial<DraftLine>): void {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setNotice(null);
    const payload: JournalLinePayload[] = lines
      .filter((line) => line.accountId)
      .map((line) => ({ accountId: line.accountId, debit: line.debit, credit: line.credit }));
    mutation.mutate({ lines: payload, idempotencyKey: crypto.randomUUID() });
  }

  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Jurnal Umum</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-sm text-muted">
            Tanggal
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="mt-1 rounded-[var(--radius-base)] border border-border px-3 py-2 text-text" />
          </label>
          <label className="flex flex-1 flex-col text-sm text-muted">
            Deskripsi
            <input value={description} onChange={(e) => setDescription(e.target.value)} required className="mt-1 rounded-[var(--radius-base)] border border-border px-3 py-2 text-text" />
          </label>
        </div>

        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-2">Akun</th>
              <th className="py-2">Debit</th>
              <th className="py-2">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="py-1 pr-2">
                  <select value={line.accountId} onChange={(e) => updateLine(index, { accountId: e.target.value })} className="w-full rounded-[var(--radius-base)] border border-border px-2 py-1 text-text">
                    <option value="">— pilih akun —</option>
                    {(accounts ?? []).map((account) => (
                      <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input value={line.debit} onChange={(e) => updateLine(index, { debit: e.target.value })} className="tabular w-full rounded-[var(--radius-base)] border border-border px-2 py-1 text-right text-text" />
                </td>
                <td className="py-1">
                  <input value={line.credit} onChange={(e) => updateLine(index, { credit: e.target.value })} className="tabular w-full rounded-[var(--radius-base)] border border-border px-2 py-1 text-right text-text" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td className="py-2 text-right text-muted">Total</td>
              <td className="tabular py-2 text-right">{totalDebit.toFixed(2)}</td>
              <td className="tabular py-2 text-right">{totalCredit.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setLines((c) => [...c, { ...EMPTY_LINE }])} className="rounded-[var(--radius-base)] border border-border px-3 py-2 text-sm">
            + Baris
          </button>
          <button type="submit" disabled={!balanced || mutation.isPending} className="rounded-[var(--radius-base)] bg-primary px-4 py-2 text-primary-fg disabled:opacity-60">
            {mutation.isPending ? 'Memposting…' : 'Posting Jurnal'}
          </button>
          {!balanced ? <span className="text-sm text-warning">Debit dan kredit harus seimbang.</span> : null}
          {notice ? <span className="text-sm text-muted">{notice}</span> : null}
        </div>
      </form>
    </section>
  );
}
