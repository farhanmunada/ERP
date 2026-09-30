export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section>
      <h1 className="mb-2 text-xl font-semibold">{title}</h1>
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 text-sm text-muted shadow-sm">
        Halaman ini akan tersedia pada iterasi berikutnya.
      </div>
    </section>
  );
}
