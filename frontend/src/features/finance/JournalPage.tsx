import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { createJournal, listAccounts } from './finance.api.ts';
import type { JournalLinePayload } from './finance.api.ts';
import {
  IconCheck,
  IconAlert,
  IconPlus,
} from '../../shared/components/icons.tsx';

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
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: { lines: readonly JournalLinePayload[]; idempotencyKey: string }) =>
      createJournal({ entryDate, description, lines: payload.lines }, payload.idempotencyKey),
    onSuccess: async () => {
      setNotice({ type: 'success', message: 'Jurnal umum berhasil dibukukan dan diposting ke buku besar.' });
      setDescription('');
      setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
      await queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
    },
    onError: (error: Error) => {
      setNotice({ type: 'error', message: error.message });
    },
  });

  function updateLine(index: number, patch: Partial<DraftLine>): void {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number): void {
    if (lines.length <= 2) return;
    setLines((current) => current.filter((_, i) => i !== index));
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
  const diff = Math.abs(totalDebit - totalCredit);
  const balanced = diff < 0.001 && totalDebit > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Jurnal Umum (General Journal)"
        description="Pencatatan transaksi berpasangan (Double Entry). Total debit dan kredit wajib seimbang."
      />

      {notice ? (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium ${
            notice.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {notice.type === 'success' ? (
            <IconCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <IconAlert className="h-5 w-5 shrink-0 text-rose-600" />
          )}
          <span>{notice.message}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Voucher Card */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold tracking-tight text-text">Informasi Bukti Transaksi</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="entryDate">
                Tanggal Pembukuan
              </label>
              <input
                id="entryDate"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="field font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="journalDesc">
                Uraian / Deskripsi Transaksi
              </label>
              <input
                id="journalDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="field"
                placeholder="Contoh: Penerimaan pembayaran piutang penjualan no. INV-001"
              />
            </div>
          </div>
        </div>

        {/* Lines Table Card */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
          <div className="border-b border-border/80 bg-slate-50/75 px-6 py-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Rincian Akun & Nominal (Baris Jurnal)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-slate-50/40 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-6 py-3 w-1/2">Akun Buku Besar</th>
                  <th className="px-6 py-3 text-right">Debit (Rp)</th>
                  <th className="px-6 py-3 text-right">Kredit (Rp)</th>
                  <th className="px-4 py-3 w-10 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((line, index) => (
                  <tr key={index} className="transition-colors hover:bg-slate-50/40">
                    <td className="px-6 py-3">
                      <select
                        value={line.accountId}
                        onChange={(e) => updateLine(index, { accountId: e.target.value })}
                        required
                        className="field text-sm"
                      >
                        <option value="">— Pilih Akun Buku Besar —</option>
                        {(accounts ?? []).map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} · {account.name} ({account.type})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <input
                        value={line.debit}
                        onChange={(e) => updateLine(index, { debit: e.target.value })}
                        className="field-mono"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        value={line.credit}
                        onChange={(e) => updateLine(index, { credit: e.target.value })}
                        className="field-mono"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        disabled={lines.length <= 2}
                        className="rounded p-1 text-slate-400 hover:text-rose-500 disabled:opacity-30"
                        title="Hapus Baris"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold text-slate-800">
                <tr>
                  <td className="px-6 py-3.5 text-right text-xs uppercase tracking-wider text-slate-500">
                    Total Keseimbangan
                  </td>
                  <td className="tabular px-6 py-3.5 text-right font-mono text-base text-slate-900">
                    {totalDebit.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="tabular px-6 py-3.5 text-right font-mono text-base text-slate-900">
                    {totalCredit.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Balance Checker & Actions */}
          <div className="flex flex-col gap-4 border-t border-border bg-slate-50/30 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {balanced ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <IconCheck className="h-4 w-4 text-emerald-600" />
                  <span>Jurnal Seimbang (Balance). Siap diposting ke buku besar.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                  <IconAlert className="h-4 w-4 text-amber-600" />
                  <span>
                    Tidak seimbang. Selisih:{' '}
                    <strong className="font-mono">
                      Rp {diff.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLines((c) => [...c, { ...EMPTY_LINE }])}
                className="btn-secondary"
              >
                <IconPlus className="h-4 w-4" />
                <span>Tambah Baris</span>
              </button>
              <button
                type="submit"
                disabled={!balanced || mutation.isPending}
                className="btn-primary"
              >
                {mutation.isPending ? 'Memproses Posting…' : 'Posting Jurnal'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
