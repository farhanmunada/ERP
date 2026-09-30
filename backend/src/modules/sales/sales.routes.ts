import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../core/middleware/auth.middleware.ts';
import { idempotencyPreHandler } from '../../core/middleware/idempotency.middleware.ts';
import { requirePermission } from '../../core/middleware/rbac.middleware.ts';
import {
  acceptQuotationHandler,
  cancelSoHandler,
  confirmSoHandler,
  convertQuotationHandler,
  createCreditNoteHandler,
  createCustomerHandler,
  createDeliveryHandler,
  createInvoiceHandler,
  createQuotationHandler,
  createSoHandler,
  getInvoiceHandler,
  getQuotationHandler,
  getSoHandler,
  listCustomersHandler,
  listDeliveriesHandler,
  listInvoicesHandler,
  listQuotationsHandler,
  listSosHandler,
  voidInvoiceHandler,
} from './sales.controller.ts';

export async function salesRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [authenticate] };
  const customerWrite = { preHandler: [authenticate, requirePermission('customer:manage')] };
  const quotationCreate = { preHandler: [authenticate, requirePermission('quotation:create')] };
  const soCreate = { preHandler: [authenticate, requirePermission('so:create')] };
  const soConfirm = { preHandler: [authenticate, requirePermission('so:confirm')] };
  const doCreate = { preHandler: [authenticate, requirePermission('do:create'), idempotencyPreHandler] };
  const invoiceCreate = { preHandler: [authenticate, requirePermission('invoice:create'), idempotencyPreHandler] };
  const invoiceVoid = { preHandler: [authenticate, requirePermission('invoice:void')] };
  const invoiceCreditNote = { preHandler: [authenticate, requirePermission('invoice:credit-note')] };

  // Customers
  app.post('/customers', customerWrite, createCustomerHandler);
  app.get('/customers', read, listCustomersHandler);

  // Quotations
  app.post('/sales/quotations', quotationCreate, createQuotationHandler);
  app.get('/sales/quotations', read, listQuotationsHandler);
  app.get('/sales/quotations/:id', read, getQuotationHandler);
  app.post('/sales/quotations/:id/accept', quotationCreate, acceptQuotationHandler);
  app.post('/sales/quotations/:id/convert-to-so', soCreate, convertQuotationHandler);

  // Sales Orders
  app.post('/sales/orders', soCreate, createSoHandler);
  app.get('/sales/orders', read, listSosHandler);
  app.get('/sales/orders/:id', read, getSoHandler);
  app.post('/sales/orders/:id/confirm', soConfirm, confirmSoHandler);
  app.post('/sales/orders/:id/cancel', soCreate, cancelSoHandler);

  // Delivery Orders
  app.post('/sales/deliveries', doCreate, createDeliveryHandler);
  app.get('/sales/deliveries', read, listDeliveriesHandler);

  // Customer Invoices
  app.post('/sales/invoices', invoiceCreate, createInvoiceHandler);
  app.get('/sales/invoices', read, listInvoicesHandler);
  app.get('/sales/invoices/:id', read, getInvoiceHandler);
  app.post('/sales/invoices/:id/void', invoiceVoid, voidInvoiceHandler);
  app.post('/sales/invoices/:id/credit-note', invoiceCreditNote, createCreditNoteHandler);
}
