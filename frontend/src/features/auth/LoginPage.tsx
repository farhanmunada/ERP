import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from './auth-context.tsx';
import { IconBuilding, IconSparkles } from '../../shared/components/icons.tsx';

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
    setError(null);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      {/* Subtle modern ambient background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/60 sm:p-10">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/30">
              <IconBuilding className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              KONTROL ERP
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sistem Operasional Retail & Distribusi
            </p>
          </div>

          {/* Quick Demo Fill Button */}
          <button
            type="button"
            onClick={fillDemo}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-100 hover:text-indigo-800"
          >
            <IconSparkles className="h-3.5 w-3.5" />
            <span>Klik di sini untuk mengisi akun demo otomatis</span>
          </button>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700" htmlFor="companyId">
                ID Perusahaan (Company ID)
              </label>
              <div className="mt-1.5">
                <input
                  id="companyId"
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  required
                  className="field font-mono text-xs"
                  placeholder="00000000-0000-4000-8000-000000000001"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700" htmlFor="email">
                Alamat Email
              </label>
              <div className="mt-1.5">
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="field text-sm"
                  placeholder="nama@perusahaan.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700" htmlFor="password">
                Kata Sandi
              </label>
              <div className="mt-1.5">
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="field text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error ? (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary mt-2 w-full py-2.5 text-sm"
            >
              {isSubmitting ? 'Memproses Masuk…' : 'Masuk ke Sistem'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Single Source of Truth • Append-only Ledger • Real-time GL
        </p>
      </div>
    </div>
  );
}
