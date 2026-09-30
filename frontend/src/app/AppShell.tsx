import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../features/auth/index.ts';

const NAV_SECTIONS = [
  {
    label: 'Ikhtisar',
    items: [{ to: '/dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Keuangan',
    items: [
      { to: '/finance/coa', label: 'Bagan Akun' },
      { to: '/finance/journals', label: 'Jurnal Umum' },
      { to: '/finance/reports', label: 'Laporan' },
    ],
  },
] as const;

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate('/login');
  }

  const initials = (user?.fullName ?? 'Pengguna')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="flex w-64 shrink-0 flex-col bg-ink text-white">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-mono text-xs tracking-[0.2em] text-white/50">ERP</p>
          <p className="mt-1 text-lg font-semibold leading-tight">Retail / Distribusi</p>
        </div>

        <nav className="flex flex-1 flex-col gap-6 px-3 py-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
                {section.label}
              </p>
              <div className="flex flex-col">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `border-l-2 px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'border-accent bg-white/5 font-medium text-white'
                          : 'border-transparent text-white/70 hover:border-white/20 hover:text-white'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 font-mono text-xs font-semibold">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.fullName ?? 'Pengguna'}</p>
              <p className="truncate text-xs text-white/50">{user?.email ?? ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-base border border-white/15 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-6 py-6 lg:px-10 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
