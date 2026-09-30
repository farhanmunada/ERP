import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../core/middleware/auth.middleware.ts';
import { requirePermission } from '../../core/middleware/rbac.middleware.ts';
import {
  createCompanyHandler,
  createUserHandler,
  listWarehousesHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
} from './iam.controller.ts';

export async function iamRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', loginHandler);
  app.post('/auth/refresh', refreshHandler);
  app.post('/auth/logout', logoutHandler);
  app.get('/me', { preHandler: [authenticate] }, meHandler);
  app.get('/warehouses', { preHandler: [authenticate] }, listWarehousesHandler);

  app.post('/companies', { preHandler: [authenticate, requirePermission('company:create')] }, createCompanyHandler);
  app.post('/users', { preHandler: [authenticate, requirePermission('user:create')] }, createUserHandler);
}
