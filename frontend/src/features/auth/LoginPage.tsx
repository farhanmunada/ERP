import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from './auth-context.tsx';

const DEMO_COMPANY_ID = '00000000-0000-4000-8000-000000000001';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password, companyId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login gagal');
    } finally {
      setIsSubmitting(false);
    }
  }

  function fillDemo(): void {
    setCompanyId(DEMO_COMPANY_ID);
    setEmail('admin@erp.local');
    setPassword('admin12345');
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between bg-ink px-12 py-14 text-white lg:flex">
        <p className="font-mono text-xs tracking-[0.24em] text-white/50">ERP · RETAIL / DISTRIBUSI</p>

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            Satu sumber kebenaran untuk seluruh operasi.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-white/60">
            Persediaan, pengadaan, penjualan, dan pembukuan dalam satu alur yang dapat diaudit —
            dari dokumen hingga jurnal.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-white/10 pt-6 font-mono text-xs text-white/50">
          <div>
            <dt className="text-white/40">Persediaan</dt>
            <dd className="mt-1 text-white/70">Moving Average</dd>
          </div>
          <div>
            <dt className="text-white/40">Mata Uang</dt>
            <dd className="mt-1 text-white/70">IDR · PPN</dd>
          </div>
          <div>
            <dt className="text-white/40">Jejak</dt>
            <dd className="mt-1 text-white/70">Append-only</dd>
          </div>
        </dl>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Masuk</h2>
          <p className="mt-1 text-sm text-muted">Gunakan kredensial perusahaan Anda.</p>

          <div className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="companyId">
              Company ID
              <input
                id="companyId"
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
                required
                className="field font-mono text-xs"
                placeholder={DEMO_COMPANY_ID}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="email">
              Email
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="field"
                placeholder="nama@perusahaan.id"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="password">
              Password
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="field"
                placeholder="••••••••"
              />
            </label>
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-base border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="btn-primary mt-6 w-full">
            {isSubmitting ? 'Memproses…' : 'Masuk'}
          </button>

          <button type="button" onClick={fillDemo} className="mt-3 w-full text-center text-xs text-muted hover:text-text">
            Isi kredensial demo
          </button>
        </form>
      </section>
    </div>
  );
}
