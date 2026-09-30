import { createBrowserRouter, Navigate } from 'react-router-dom';

import { LoginPage } from '../features/auth/index.ts';
import { DashboardPage } from '../features/dashboard/index.ts';
import { CoaPage, JournalPage, ReportsPage } from '../features/finance/index.ts';
import { ItemsPage, MovementsPage, OpnamePage, StockPage, TransferPage } from '../features/inventory/index.ts';
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
      { path: 'finance/coa', element: <CoaPage /> },
      { path: 'finance/journals', element: <JournalPage /> },
      { path: 'finance/reports', element: <ReportsPage /> },
    ],
  },
]);
