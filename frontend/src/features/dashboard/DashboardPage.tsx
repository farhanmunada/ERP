const STAT_CARDS = [
  { label: 'Stok Rendah', value: '—' },
  { label: 'PO Pending', value: '—' },
  { label: 'Total AR', value: '—' },
  { label: 'Total AP', value: '—' },
] as const;

export function DashboardPage() {
  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-sm">
            <p className="text-sm text-muted">{card.label}</p>
            <p className="tabular mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-sm">
        <p className="text-sm text-muted">Belum ada data. Dokumen menunggu approval akan tampil di sini.</p>
      </div>
    </section>
  );
}
