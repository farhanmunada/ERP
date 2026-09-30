import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../features/auth/index.ts';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/finance/coa', label: 'Chart of Accounts' },
  { to: '/finance/journals', label: 'Jurnal' },
  { to: '/finance/reports', label: 'Laporan' },
] as const;

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-border bg-surface p-4">
        <p className="mb-6 px-2 text-lg font-semibold text-primary">ERP</p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-[var(--radius-base)] px-3 py-2 text-sm ${
                  isActive ? 'bg-primary text-primary-fg' : 'text-text hover:bg-bg'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
          <span className="text-sm text-muted">{user?.fullName ?? 'Pengguna'}</span>
          <button onClick={handleLogout} className="text-sm text-danger">
            Keluar
          </button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
