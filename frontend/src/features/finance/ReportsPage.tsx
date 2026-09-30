import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { getTrialBalance } from './finance.api.ts';

export function ReportsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['trial-balance'], queryFn: getTrialBalance });

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title="Laporan" description="Trial balance per akun, dihitung langsung dari buku besar." />

      {isLoading ? <p className="text-sm text-muted">Memuat…</p> : null}
      {error ? <p className="text-sm text-danger">{error.message}</p> : null}

      {data ? (
        <>
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
              data.balanced ? 'border-success/30 bg-success/5 text-success' : 'border-danger/30 bg-danger/5 text-danger'
            }`}
          >
            <span className="font-mono text-xs font-semibold">
              {data.balanced ? 'BALANCED' : 'OUT OF BALANCE'}
            </span>
            <span>
              {data.balanced
                ? 'Trial balance seimbang — total debit sama dengan total kredit.'
                : 'Trial balance tidak seimbang. Periksa jurnal terakhir.'}
            </span>
          </div>

          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3 font-mono">KODE</th>
                  <th className="px-5 py-3">NAMA</th>
                  <th className="px-5 py-3 text-right">DEBIT</th>
                  <th className="px-5 py-3 text-right">KREDIT</th>
                  <th className="px-5 py-3 text-right">SALDO</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line) => (
                  <tr key={line.accountId} className="border-b border-border last:border-0 hover:bg-canvas">
                    <td className="tabular px-5 py-3 font-mono text-xs">{line.code}</td>
                    <td className="px-5 py-3">{line.name}</td>
                    <td className="tabular px-5 py-3 text-right font-mono">{line.debit}</td>
                    <td className="tabular px-5 py-3 text-right font-mono">{line.credit}</td>
                    <td className="tabular px-5 py-3 text-right font-mono font-medium">{line.balance}</td>
                  </tr>
                ))}
                {data.lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                      Belum ada pergerakan akun untuk dilaporkan.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-strong font-semibold">
                  <td className="px-5 py-3" colSpan={2}>
                    Total
                  </td>
                  <td className="tabular px-5 py-3 text-right font-mono">{data.totalDebit}</td>
                  <td className="tabular px-5 py-3 text-right font-mono">{data.totalCredit}</td>
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
