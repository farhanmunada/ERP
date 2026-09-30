import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../core/middleware/auth.middleware.ts';
import { idempotencyPreHandler } from '../../core/middleware/idempotency.middleware.ts';
import { requirePermission } from '../../core/middleware/rbac.middleware.ts';
import {
  approvePoHandler,
  approvePrHandler,
  convertPrHandler,
  createBillHandler,
  createGrnHandler,
  createPoHandler,
  createPrHandler,
  createVendorHandler,
  getBillHandler,
  getBillMatchHandler,
  getPoHandler,
  getPrHandler,
  getSettingsHandler,
  listBillsHandler,
  listGrnsHandler,
  listPosHandler,
  listPrsHandler,
  listVendorsHandler,
  overrideBillHandler,
  postBillHandler,
  rejectPoHandler,
  submitPoHandler,
  updateSettingsHandler,
} from './procurement.controller.ts';

export async function procurementRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [authenticate] };
  const vendorWrite = { preHandler: [authenticate, requirePermission('vendor:manage')] };
  const prCreate = { preHandler: [authenticate, requirePermission('pr:create')] };
  const prApprove = { preHandler: [authenticate, requirePermission('pr:approve')] };
  const poCreate = { preHandler: [authenticate, requirePermission('po:create')] };
  const poApprove = { preHandler: [authenticate, requirePermission('po:approve')] };
  const grnCreate = { preHandler: [authenticate, requirePermission('grn:create'), idempotencyPreHandler] };
  const billCreate = { preHandler: [authenticate, requirePermission('bill:create')] };
  const billOverride = { preHandler: [authenticate, requirePermission('bill:override')] };
  const billPost = { preHandler: [authenticate, requirePermission('bill:post')] };
  const settingsWrite = { preHandler: [authenticate, requirePermission('bill:override')] };

  // Vendors
  app.post('/vendors', vendorWrite, createVendorHandler);
  app.get('/vendors', read, listVendorsHandler);

  // Purchase Requisitions
  app.post('/procurement/pr', prCreate, createPrHandler);
  app.get('/procurement/pr', read, listPrsHandler);
  app.get('/procurement/pr/:id', read, getPrHandler);
  app.post('/procurement/pr/:id/approve', prApprove, approvePrHandler);
  app.post('/procurement/pr/:id/convert-to-po', poCreate, convertPrHandler);

  // Purchase Orders
  app.post('/procurement/po', poCreate, createPoHandler);
  app.get('/procurement/po', read, listPosHandler);
  app.get('/procurement/po/:id', read, getPoHandler);
  app.post('/procurement/po/:id/submit', poCreate, submitPoHandler);
  app.post('/procurement/po/:id/approve', poApprove, approvePoHandler);
  app.post('/procurement/po/:id/reject', poApprove, rejectPoHandler);

  // Goods Receipts
  app.post('/procurement/grn', grnCreate, createGrnHandler);
  app.get('/procurement/grn', read, listGrnsHandler);

  // Vendor Bills
  app.post('/procurement/bills', billCreate, createBillHandler);
  app.get('/procurement/bills', read, listBillsHandler);
  app.get('/procurement/bills/:id', read, getBillHandler);
  app.get('/procurement/bills/:id/match', read, getBillMatchHandler);
  app.post('/procurement/bills/:id/override', billOverride, overrideBillHandler);
  app.post('/procurement/bills/:id/post', billPost, postBillHandler);

  // Settings
  app.get('/procurement/settings', read, getSettingsHandler);
  app.put('/procurement/settings', settingsWrite, updateSettingsHandler);
}
