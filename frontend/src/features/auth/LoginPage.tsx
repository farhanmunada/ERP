import { useState } from 'react';
import type { FormEvent } from 'react';

import { useAuth } from './auth-context.tsx';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-[var(--radius-lg)] border border-border bg-surface p-8 shadow-sm"
      >
        <h1 className="mb-6 text-center text-xl font-semibold text-primary">ERP Retail/Distribusi</h1>

        <label className="mb-1 block text-sm text-muted" htmlFor="companyId">
          Company ID
        </label>
        <input
          id="companyId"
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
          className="mb-4 w-full rounded-[var(--radius-base)] border border-border px-3 py-2"
          placeholder="UUID perusahaan"
        />

        <label className="mb-1 block text-sm text-muted" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mb-4 w-full rounded-[var(--radius-base)] border border-border px-3 py-2"
        />

        <label className="mb-1 block text-sm text-muted" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mb-4 w-full rounded-[var(--radius-base)] border border-border px-3 py-2"
        />

        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-[var(--radius-base)] bg-primary px-4 py-2 text-primary-fg disabled:opacity-60"
        >
          {isSubmitting ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
