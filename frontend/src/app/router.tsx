import { createBrowserRouter, Navigate } from 'react-router-dom';

import { LoginPage } from '../features/auth/index.ts';
import { DashboardPage } from '../features/dashboard/index.ts';
import { AppShell } from './AppShell.tsx';
import { RequireAuth } from './RequireAuth.tsx';
import { PlaceholderPage } from '../shared/components/PlaceholderPage.tsx';

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
      { path: 'finance/coa', element: <PlaceholderPage title="Chart of Accounts" /> },
      { path: 'finance/journals', element: <PlaceholderPage title="Jurnal" /> },
      { path: 'finance/reports', element: <PlaceholderPage title="Laporan Keuangan" /> },
    ],
  },
]);
