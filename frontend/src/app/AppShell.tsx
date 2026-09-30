import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { ComponentType, SVGProps } from 'react';

import { useAuth } from '../features/auth/index.ts';
import {
  IconBuilding,
  IconDashboard,
  IconBook,
  IconJournal,
  IconReports,
  IconLogout,
  IconBox,
  IconWarehouse,
  IconArrows,
  IconClipboard,
  IconList,
  IconTruck,
  IconStore,
  IconFileText,
  IconReceipt,
  IconUsers,
  IconCart,
} from '../shared/components/icons.tsx';

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const NAV_SECTIONS: readonly { readonly title: string; readonly items: readonly NavItem[] }[] = [
  {
    title: 'Menu Utama',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: IconDashboard }],
  },
  {
    title: 'Persediaan',
    items: [
      { to: '/inventory/items', label: 'Master Item', icon: IconBox },
      { to: '/inventory/stock', label: 'Stok', icon: IconWarehouse },
      { to: '/inventory/movements', label: 'Mutasi Stok', icon: IconList },
      { to: '/inventory/transfer', label: 'Transfer Gudang', icon: IconArrows },
      { to: '/inventory/opname', label: 'Stock Opname', icon: IconClipboard },
    ],
  },
  {
    title: 'Pengadaan',
    items: [
      { to: '/master/vendors', label: 'Master Vendor', icon: IconStore },
      { to: '/procurement/pr', label: 'Purchase Requisition', icon: IconClipboard },
      { to: '/procurement/po', label: 'Purchase Order', icon: IconTruck },
      { to: '/procurement/grn', label: 'Penerimaan Barang', icon: IconReceipt },
      { to: '/procurement/bills', label: 'Tagihan Vendor', icon: IconFileText },
    ],
  },
  {
    title: 'Penjualan',
    items: [
      { to: '/master/customers', label: 'Master Customer', icon: IconUsers },
      { to: '/sales/quotations', label: 'Quotation', icon: IconCart },
      { to: '/sales/orders', label: 'Sales Order', icon: IconClipboard },
      { to: '/sales/deliveries', label: 'Delivery Order', icon: IconTruck },
      { to: '/sales/invoices', label: 'Customer Invoice', icon: IconFileText },
    ],
  },
  {
    title: 'Keuangan',
    items: [
      { to: '/finance/coa', label: 'Bagan Akun (COA)', icon: IconBook },
      { to: '/finance/journals', label: 'Jurnal Umum', icon: IconJournal },
      { to: '/finance/reports', label: 'Laporan Keuangan', icon: IconReports },
    ],
  },
];

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
            P0d
          </span>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {section.title}
              </p>
              <nav className="space-y-1">
                {section.items.map((item) => {
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
          ))}
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
