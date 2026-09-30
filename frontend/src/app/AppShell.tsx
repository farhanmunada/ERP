import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../features/auth/index.ts';
import {
  IconBuilding,
  IconDashboard,
  IconBook,
  IconJournal,
  IconReports,
  IconLogout,
} from '../shared/components/icons.tsx';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/finance/coa', label: 'Bagan Akun (COA)', icon: IconBook },
  { to: '/finance/journals', label: 'Jurnal Umum', icon: IconJournal },
  { to: '/finance/reports', label: 'Laporan Keuangan', icon: IconReports },
] as const;

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate('/login');
  }

  const initials = (user?.fullName ?? 'Admin')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Sleek Modern Dark Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300">
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-md shadow-primary/20">
              <IconBuilding className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight">KONTROL ERP</p>
              <p className="text-[11px] text-slate-400">Retail & Distribusi</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
            P0a
          </span>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Menu Utama
          </p>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-sm shadow-primary/30'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className="border-t border-slate-800/80 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-xs font-bold text-primary-light">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user?.fullName ?? 'Admin'}</p>
              <p className="truncate font-mono text-[10px] text-slate-400">{user?.email ?? 'admin@erp.local'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Keluar"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-rose-400"
            >
              <IconLogout className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted">Perusahaan Aktif:</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-canvas px-2.5 py-1 text-xs font-semibold text-text border border-border">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              DEMO ENTERPRISE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              Sistem Normal
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
