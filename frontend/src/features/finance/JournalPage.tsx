import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
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
      <PageHeader
        title="Jurnal Umum"
        description="Catat jurnal berpasangan. Debit dan kredit harus seimbang sebelum diposting."
      />

      <form onSubmit={handleSubmit} className="panel flex flex-col">
        <div className="flex flex-wrap gap-4 border-b border-border p-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Tanggal
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="field font-mono"
            />
          </label>
          <label className="flex min-w-[240px] flex-1 flex-col gap-1.5 text-sm font-medium">
            Deskripsi
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="field"
              placeholder="Mis. Penjualan tunai harian"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">AKUN</th>
                <th className="w-40 px-4 py-3 text-right">DEBIT</th>
                <th className="w-40 px-4 py-3 text-right">KREDIT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <select
                      value={line.accountId}
                      onChange={(e) => updateLine(index, { accountId: e.target.value })}
                      className="field w-full"
                    >
                      <option value="">— pilih akun —</option>
                      {(accounts ?? []).map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} · {account.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={line.debit}
                      onChange={(e) => updateLine(index, { debit: e.target.value })}
                      className="field-mono w-full"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={line.credit}
                      onChange={(e) => updateLine(index, { credit: e.target.value })}
                      className="field-mono w-full"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong font-semibold">
                <td className="px-4 py-3 text-right text-muted">Total</td>
                <td className="tabular px-4 py-3 text-right font-mono">{totalDebit.toFixed(2)}</td>
                <td className="tabular px-4 py-3 text-right font-mono">{totalCredit.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border p-4">
          <button type="button" onClick={() => setLines((c) => [...c, { ...EMPTY_LINE }])} className="btn-ghost">
            + Baris
          </button>
          <button type="submit" disabled={!balanced || mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Memposting…' : 'Posting Jurnal'}
          </button>
          {!balanced ? <span className="text-sm text-warning">Debit dan kredit harus seimbang.</span> : null}
          {notice ? <span className="text-sm text-muted">{notice}</span> : null}
        </div>
      </form>
    </section>
  );
}
