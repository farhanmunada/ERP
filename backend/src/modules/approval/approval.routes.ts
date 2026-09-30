import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../core/middleware/auth.middleware.ts';
import { requirePermission } from '../../core/middleware/rbac.middleware.ts';
import { createRuleHandler, decideApprovalHandler, submitApprovalHandler } from './approval.controller.ts';

export async function approvalRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/approval/rules',
    { preHandler: [authenticate, requirePermission('approval:rule:manage')] },
    createRuleHandler,
  );
  app.post('/approval/requests', { preHandler: [authenticate] }, submitApprovalHandler);
  app.post(
    '/approval/requests/:id/decide',
    { preHandler: [authenticate, requirePermission('approval:decide')] },
    decideApprovalHandler,
  );
}
