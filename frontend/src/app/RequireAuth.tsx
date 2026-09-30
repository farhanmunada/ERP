import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../features/auth/index.ts';

export function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
