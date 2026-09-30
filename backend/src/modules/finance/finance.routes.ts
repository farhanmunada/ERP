import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../core/middleware/auth.middleware.ts';
import { requirePermission } from '../../core/middleware/rbac.middleware.ts';
import {
  balanceSheetHandler,
  createAccountHandler,
  createJournalHandler,
  listAccountsHandler,
  profitLossHandler,
  reverseJournalHandler,
  trialBalanceHandler,
} from './finance.controller.ts';

export async function financeRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: [authenticate] };

  app.post('/coa', { preHandler: [authenticate, requirePermission('coa:create')] }, createAccountHandler);
  app.get('/coa', guard, listAccountsHandler);

  app.post('/finance/journals', { preHandler: [authenticate, requirePermission('journal:create')] }, createJournalHandler);
  app.post('/finance/journals/:id/reverse', { preHandler: [authenticate, requirePermission('journal:reverse')] }, reverseJournalHandler);

  app.get('/finance/reports/trial-balance', guard, trialBalanceHandler);
  app.get('/finance/reports/balance-sheet', guard, balanceSheetHandler);
  app.get('/finance/reports/profit-loss', guard, profitLossHandler);
}
