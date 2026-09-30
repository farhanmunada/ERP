import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../core/middleware/auth.middleware.ts';
import { idempotencyPreHandler } from '../../core/middleware/idempotency.middleware.ts';
import { requirePermission } from '../../core/middleware/rbac.middleware.ts';
import {
  completeTransferHandler,
  createItemHandler,
  createOpnameHandler,
  createTransferHandler,
  getItemHandler,
  listItemsHandler,
  listMovementsHandler,
  listOpnamesHandler,
  listStockHandler,
  listTransfersHandler,
  stockInHandler,
  stockOutHandler,
  updateItemHandler,
} from './inventory.controller.ts';

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [authenticate] };
  const write = { preHandler: [authenticate, requirePermission('inventory:manage')] };
  const idempotent = { preHandler: [authenticate, requirePermission('inventory:manage'), idempotencyPreHandler] };

  // Master item
  app.post('/items', write, createItemHandler);
  app.get('/items', read, listItemsHandler);
  app.get('/items/:id', read, getItemHandler);
  app.put('/items/:id', write, updateItemHandler);

  // Stock
  app.get('/inventory/stock', read, listStockHandler);
  app.post('/inventory/stock-in', idempotent, stockInHandler);
  app.post('/inventory/stock-out', idempotent, stockOutHandler);
  app.get('/inventory/movements', read, listMovementsHandler);

  // Transfer
  app.post('/inventory/transfer', idempotent, createTransferHandler);
  app.get('/inventory/transfers', read, listTransfersHandler);
  app.post('/inventory/transfer/:id/complete', write, completeTransferHandler);

  // Opname
  app.post('/inventory/opname', idempotent, createOpnameHandler);
  app.get('/inventory/opnames', read, listOpnamesHandler);
}
