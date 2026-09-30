import { createBrowserRouter, Navigate } from 'react-router-dom';

import { LoginPage } from '../features/auth/index.ts';
import { DashboardPage } from '../features/dashboard/index.ts';
import { CoaPage, JournalPage, ReportsPage } from '../features/finance/index.ts';
import { ItemsPage, MovementsPage, OpnamePage, StockPage, TransferPage } from '../features/inventory/index.ts';
import { BillPage, GrnPage, PoPage, PrPage, VendorsPage } from '../features/procurement/index.ts';
import { CustomersPage, DeliveriesPage, InvoicesPage, OrdersPage, QuotationsPage } from '../features/sales/index.ts';
import { AppShell } from './AppShell.tsx';
import { RequireAuth } from './RequireAuth.tsx';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'inventory/items', element: <ItemsPage /> },
      { path: 'inventory/stock', element: <StockPage /> },
      { path: 'inventory/movements', element: <MovementsPage /> },
      { path: 'inventory/transfer', element: <TransferPage /> },
      { path: 'inventory/opname', element: <OpnamePage /> },
      { path: 'master/vendors', element: <VendorsPage /> },
      { path: 'procurement/pr', element: <PrPage /> },
      { path: 'procurement/po', element: <PoPage /> },
      { path: 'procurement/grn', element: <GrnPage /> },
      { path: 'procurement/bills', element: <BillPage /> },
      { path: 'master/customers', element: <CustomersPage /> },
      { path: 'sales/quotations', element: <QuotationsPage /> },
      { path: 'sales/orders', element: <OrdersPage /> },
      { path: 'sales/deliveries', element: <DeliveriesPage /> },
      { path: 'sales/invoices', element: <InvoicesPage /> },
      { path: 'finance/coa', element: <CoaPage /> },
      { path: 'finance/journals', element: <JournalPage /> },
      { path: 'finance/reports', element: <ReportsPage /> },
    ],
  },
]);
