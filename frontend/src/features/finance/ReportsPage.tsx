import { useQuery } from '@tanstack/react-query';

import { getTrialBalance } from './finance.api.ts';

export function ReportsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['trial-balance'], queryFn: getTrialBalance });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Laporan — Trial Balance</h1>

      {isLoading ? <p className="text-sm text-muted">Memuat…</p> : null}
      {error ? <p className="text-sm text-danger">{error.message}</p> : null}

      {data ? (
        <>
          <div className={`rounded-[var(--radius-base)] border p-3 text-sm ${data.balanced ? 'border-success text-success' : 'border-danger text-danger'}`}>
            {data.balanced ? 'Trial balance seimbang ✓' : 'Trial balance TIDAK seimbang ✗'}
          </div>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-bg text-left text-muted">
                <tr>
                  <th className="px-4 py-2">Kode</th>
                  <th className="px-4 py-2">Nama</th>
                  <th className="px-4 py-2 text-right">Debit</th>
                  <th className="px-4 py-2 text-right">Kredit</th>
                  <th className="px-4 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line) => (
                  <tr key={line.accountId} className="border-t border-border">
                    <td className="tabular px-4 py-2">{line.code}</td>
                    <td className="px-4 py-2">{line.name}</td>
                    <td className="tabular px-4 py-2 text-right">{line.debit}</td>
                    <td className="tabular px-4 py-2 text-right">{line.credit}</td>
                    <td className="tabular px-4 py-2 text-right">{line.balance}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="px-4 py-2" colSpan={2}>Total</td>
                  <td className="tabular px-4 py-2 text-right">{data.totalDebit}</td>
                  <td className="tabular px-4 py-2 text-right">{data.totalCredit}</td>
                  <td className="px-4 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
