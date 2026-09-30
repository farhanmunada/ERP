import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { getTrialBalance } from '../finance/finance.api.ts';

interface Metric {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export function DashboardPage() {
  const { data } = useQuery({ queryKey: ['trial-balance'], queryFn: getTrialBalance });

  const accountCount = data?.lines.length ?? 0;
  const metrics: readonly Metric[] = [
    { label: 'Akun Aktif', value: String(accountCount), hint: 'terdaftar di bagan akun' },
    { label: 'Total Debit', value: data?.totalDebit ?? '—', hint: 'trial balance' },
    { label: 'Total Kredit', value: data?.totalCredit ?? '—', hint: 'trial balance' },
    { label: 'Keseimbangan', value: data ? (data.balanced ? 'Seimbang' : 'Selisih') : '—', hint: 'debit = kredit' },
  ];

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="Ringkasan pembukuan dan dokumen yang menunggu tindakan Anda."
      />

      <div className="grid grid-cols-2 divide-border overflow-hidden rounded-lg border border-border bg-surface lg:grid-cols-4 lg:divide-x">
        {metrics.map((metric) => (
          <div key={metric.label} className="border-b border-border px-5 py-4 lg:border-b-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{metric.label}</p>
            <p className="tabular mt-2 font-mono text-2xl font-semibold text-text">{metric.value}</p>
            <p className="mt-1 text-xs text-muted">{metric.hint}</p>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Menunggu Approval</h2>
          <span className="font-mono text-xs text-muted">0 dokumen</span>
        </div>
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted">Belum ada dokumen yang menunggu approval.</p>
          <p className="mt-1 text-xs text-muted">
            Dokumen pengadaan dan penjualan yang butuh persetujuan Anda akan muncul di sini.
          </p>
        </div>
      </div>
    </section>
  );
}
