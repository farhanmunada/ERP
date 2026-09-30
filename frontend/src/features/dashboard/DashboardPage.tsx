import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PageHeader } from '../../shared/components/PageHeader.tsx';
import { getTrialBalance } from '../finance/finance.api.ts';
import {
  IconBook,
  IconJournal,
  IconReports,
  IconCheck,
  IconAlert,
  IconPlus,
} from '../../shared/components/icons.tsx';

export function DashboardPage() {
  const { data } = useQuery({ queryKey: ['trial-balance'], queryFn: getTrialBalance });

  const accountCount = data?.lines.length ?? 0;
  const isBalanced = data?.balanced ?? true;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard Utama"
        description="Ringkasan operasional buku besar dan status dokumen terkini."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/finance/journals" className="btn-primary">
              <IconPlus className="h-4 w-4" />
              <span>Buat Jurnal</span>
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Akun Aktif */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold tracking-wider uppercase">Bagan Akun</span>
            <div className="rounded-lg bg-indigo-50 p-2 text-primary">
              <IconBook className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="tabular font-mono text-3xl font-bold tracking-tight text-text">
              {accountCount}
            </p>
            <p className="mt-1 text-xs text-muted">Akun aktif terdaftar</p>
          </div>
        </div>

        {/* Card 2: Total Debit */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold tracking-wider uppercase">Total Debit</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <IconJournal className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="tabular font-mono text-2xl font-bold tracking-tight text-text">
              {data?.totalDebit ? `Rp ${data.totalDebit}` : 'Rp 0.00'}
            </p>
            <p className="mt-1 text-xs text-muted">Akumulasi buku besar</p>
          </div>
        </div>

        {/* Card 3: Total Kredit */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold tracking-wider uppercase">Total Kredit</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <IconJournal className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="tabular font-mono text-2xl font-bold tracking-tight text-text">
              {data?.totalCredit ? `Rp ${data.totalCredit}` : 'Rp 0.00'}
            </p>
            <p className="mt-1 text-xs text-muted">Akumulasi buku besar</p>
          </div>
        </div>

        {/* Card 4: Keseimbangan */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold tracking-wider uppercase">Neraca Saldo</span>
            <div className={`rounded-lg p-2 ${isBalanced ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {isBalanced ? <IconCheck className="h-4 w-4" /> : <IconAlert className="h-4 w-4" />}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                isBalanced
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                  : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
              }`}>
                {isBalanced ? 'SEIMBANG' : 'ADA SELISIH'}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {isBalanced ? 'Debit & kredit klop sempurna' : 'Periksa jurnal terakhir'}
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Quick Nav + Approval Queue */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Nav Cards */}
        <div className="card lg:col-span-1 space-y-4">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider">Akses Cepat</h2>
          <div className="space-y-2">
            <Link
              to="/finance/coa"
              className="flex items-center justify-between rounded-lg border border-border p-3 text-sm font-medium transition-all hover:border-primary/40 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <IconBook className="h-4 w-4 text-primary" />
                <span>Kelola Bagan Akun (COA)</span>
              </div>
              <span className="text-xs text-muted">→</span>
            </Link>

            <Link
              to="/finance/journals"
              className="flex items-center justify-between rounded-lg border border-border p-3 text-sm font-medium transition-all hover:border-primary/40 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <IconJournal className="h-4 w-4 text-primary" />
                <span>Posting Jurnal Umum</span>
              </div>
              <span className="text-xs text-muted">→</span>
            </Link>

            <Link
              to="/finance/reports"
              className="flex items-center justify-between rounded-lg border border-border p-3 text-sm font-medium transition-all hover:border-primary/40 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <IconReports className="h-4 w-4 text-primary" />
                <span>Laporan Neraca Saldo</span>
              </div>
              <span className="text-xs text-muted">→</span>
            </Link>
          </div>
        </div>

        {/* Approval Queue */}
        <div className="card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <h2 className="text-sm font-bold text-text uppercase tracking-wider">
              Antrean Persetujuan Dokumen
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">
              0 Menunggu
            </span>
          </div>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <IconCheck className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">Semua Dokumen Beres</p>
            <p className="mt-1 max-w-sm text-xs text-muted">
              Tidak ada dokumen pengadaan atau penjualan yang sedang menunggu persetujuan Anda saat ini.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
