import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { getTrialBalance } from './finance.api.ts';
import { IconCheck, IconAlert, IconReports } from '../../shared/components/icons.tsx';

export function ReportsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['trial-balance'], queryFn: getTrialBalance });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Laporan Neraca Saldo (Trial Balance)"
        description="Ringkasan posisi saldo debit dan kredit dari setiap akun buku besar per saat ini."
      />

      {isLoading ? (
        <div className="card text-center text-sm text-muted py-12">
          Memuat data laporan neraca saldo…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Gagal mengambil laporan: {error.message}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-6">
          {/* Status Alert Banner */}
          <div
            className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium ${
              data.balanced
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {data.balanced ? (
              <IconCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <IconAlert className="h-5 w-5 shrink-0 text-rose-600" />
            )}
            <div>
              <p className="font-semibold">
                {data.balanced ? 'Neraca Saldo Sempurna (Balanced)' : 'Neraca Saldo Tidak Seimbang'}
              </p>
              <p className="text-xs opacity-90 mt-0.5">
                {data.balanced
                  ? 'Total debit sama dengan total kredit. Pembukuan berada dalam kondisi valid.'
                  : 'Ditemukan perbedaan antara total debit dan kredit. Harap periksa jurnal pembukuan terbaru.'}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Total Debit</span>
              <p className="tabular font-mono text-2xl font-bold text-slate-900">
                Rp {data.totalDebit}
              </p>
            </div>
            <div className="card space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Total Kredit</span>
              <p className="tabular font-mono text-2xl font-bold text-slate-900">
                Rp {data.totalCredit}
              </p>
            </div>
            <div className="card space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Jumlah Baris Akun</span>
              <p className="tabular font-mono text-2xl font-bold text-slate-900">
                {data.lines.length} Akun
              </p>
            </div>
          </div>

          {/* Report Table */}
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
            <div className="border-b border-border/80 bg-slate-50/75 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconReports className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Daftar Saldo Akun Buku Besar
                </h2>
              </div>
              <span className="font-mono text-xs text-muted">Mata Uang: IDR (Rupiah)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Kode</th>
                    <th className="px-6 py-3.5">Nama Akun</th>
                    <th className="px-6 py-3.5 text-right">Debit (Rp)</th>
                    <th className="px-6 py-3.5 text-right">Kredit (Rp)</th>
                    <th className="px-6 py-3.5 text-right">Saldo Bersih (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.lines.map((line) => (
                    <tr key={line.accountId} className="transition-colors hover:bg-slate-50/50">
                      <td className="tabular px-6 py-3.5 font-mono text-xs font-bold text-slate-900">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-800">
                          {line.code}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-slate-800">{line.name}</td>
                      <td className="tabular px-6 py-3.5 text-right font-mono text-slate-700">{line.debit}</td>
                      <td className="tabular px-6 py-3.5 text-right font-mono text-slate-700">{line.credit}</td>
                      <td className="tabular px-6 py-3.5 text-right font-mono font-semibold text-slate-900">
                        {line.balance}
                      </td>
                    </tr>
                  ))}

                  {data.lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted">
                        Belum ada data jurnal yang diposting untuk neraca saldo ini.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50/90 font-bold text-slate-900">
                  <tr>
                    <td className="px-6 py-4 text-xs uppercase tracking-wider text-slate-600" colSpan={2}>
                      Total Saldo Keseluruhan
                    </td>
                    <td className="tabular px-6 py-4 text-right font-mono text-base text-primary">
                      {data.totalDebit}
                    </td>
                    <td className="tabular px-6 py-4 text-right font-mono text-base text-primary">
                      {data.totalCredit}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-muted">
                      {data.balanced ? 'SEIMBANG ✓' : 'SELISIH ✗'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
