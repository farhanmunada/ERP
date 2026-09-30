import { boolean, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

import { createdAt, money, qty, updatedAt, uuid } from './columns.ts';

// Master customer. credit_limit drives the SO confirmation credit check (PRD Story 4.1.2).
export const customers = mysqlTable(
  'customers',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    code: varchar('code', { length: 30 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    email: varchar('email', { length: 150 }),
    phone: varchar('phone', { length: 30 }),
    address: varchar('address', { length: 255 }),
    npwp: varchar('npwp', { length: 30 }),
    creditLimit: money('credit_limit').notNull().default('0.00'),
    paymentTermDays: int('payment_term_days').notNull().default(30),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('uq_customer_company_code').on(table.companyId, table.code)],
);

// Quotation header. Lightweight: DRAFT -> ACCEPTED -> CONVERTED (PRD Story 4.1).
export const quotations = mysqlTable(
  'quotations',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    quoteDate: varchar('quote_date', { length: 10 }).notNull(),
    customerId: uuid('customer_id').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    subtotal: money('subtotal').notNull().default('0.00'),
    tax: money('tax').notNull().default('0.00'),
    total: money('total').notNull().default('0.00'),
    validUntil: varchar('valid_until', { length: 10 }),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('uq_quotation_company_doc').on(table.companyId, table.docNumber)],
);

export const quotationLines = mysqlTable(
  'quotation_lines',
  {
    id: uuid('id').primaryKey(),
    quotationId: uuid('quotation_id').notNull(),
    itemId: uuid('item_id').notNull(),
    qty: qty('qty').notNull(),
    unitPrice: money('unit_price').notNull(),
    discount: money('discount').notNull().default('0.00'),
    subtotal: money('subtotal').notNull(),
  },
  (table) => [index('idx_quotation_line_quotation').on(table.quotationId)],
);

// Sales Order header. Confirmation performs credit check + soft reserve (PRD Story 4.1/4.2).
export const salesOrders = mysqlTable(
  'sales_orders',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    soDate: varchar('so_date', { length: 10 }).notNull(),
    customerId: uuid('customer_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    quotationId: uuid('quotation_id'),
    subtotal: money('subtotal').notNull().default('0.00'),
    tax: money('tax').notNull().default('0.00'),
    total: money('total').notNull().default('0.00'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_so_company_doc').on(table.companyId, table.docNumber),
    index('idx_so_company_customer').on(table.companyId, table.customerId),
  ],
);

// delivered_qty/invoiced_qty accumulate across partial DOs and invoices (PRD Story 4.2.2).
export const salesOrderLines = mysqlTable(
  'sales_order_lines',
  {
    id: uuid('id').primaryKey(),
    soId: uuid('so_id').notNull(),
    itemId: uuid('item_id').notNull(),
    qty: qty('qty').notNull(),
    unitPrice: money('unit_price').notNull(),
    discount: money('discount').notNull().default('0.00'),
    subtotal: money('subtotal').notNull(),
    deliveredQty: qty('delivered_qty').notNull().default('0.0000'),
    invoicedQty: qty('invoiced_qty').notNull().default('0.0000'),
  },
  (table) => [index('idx_so_line_so').on(table.soId)],
);

// Delivery Order. Releases reserve + stock-out (COGS) atomically; created as POSTED.
export const deliveryOrders = mysqlTable(
  'delivery_orders',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    doDate: varchar('do_date', { length: 10 }).notNull(),
    soId: uuid('so_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_do_company_doc').on(table.companyId, table.docNumber),
    index('idx_do_company_so').on(table.companyId, table.soId),
  ],
);

// unit_cost is the realised COGS per unit from the costing engine (MA/FIFO).
export const deliveryOrderLines = mysqlTable(
  'delivery_order_lines',
  {
    id: uuid('id').primaryKey(),
    doId: uuid('do_id').notNull(),
    soLineId: uuid('so_line_id').notNull(),
    itemId: uuid('item_id').notNull(),
    qtyDelivered: qty('qty_delivered').notNull(),
    unitCost: money('unit_cost').notNull(),
    batchNo: varchar('batch_no', { length: 50 }),
  },
  (table) => [index('idx_do_line_do').on(table.doId)],
);

// Customer Invoice. Posts AR/revenue (+PPN) and COGS/Inventory in one atomic journal (PRD Story 4.3).
export const customerInvoices = mysqlTable(
  'customer_invoices',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    invoiceDate: varchar('invoice_date', { length: 10 }).notNull(),
    customerId: uuid('customer_id').notNull(),
    doId: uuid('do_id'),
    status: varchar('status', { length: 20 }).notNull(),
    subtotal: money('subtotal').notNull().default('0.00'),
    tax: money('tax').notNull().default('0.00'),
    total: money('total').notNull().default('0.00'),
    cogs: money('cogs').notNull().default('0.00'),
    journalEntryId: uuid('journal_entry_id'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_invoice_company_doc').on(table.companyId, table.docNumber),
    index('idx_invoice_company_customer').on(table.companyId, table.customerId),
  ],
);

export const customerInvoiceLines = mysqlTable(
  'customer_invoice_lines',
  {
    id: uuid('id').primaryKey(),
    invoiceId: uuid('invoice_id').notNull(),
    soLineId: uuid('so_line_id'),
    itemId: uuid('item_id').notNull(),
    qty: qty('qty').notNull(),
    unitPrice: money('unit_price').notNull(),
    amount: money('amount').notNull(),
    unitCost: money('unit_cost').notNull().default('0.00'),
    cogsAmount: money('cogs_amount').notNull().default('0.00'),
  },
  (table) => [index('idx_invoice_line_invoice').on(table.invoiceId)],
);

// Credit note (partial return). Reverses revenue+AR and COGS+Inventory; no physical stock return in P0.
export const creditNotes = mysqlTable(
  'credit_notes',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    cnDate: varchar('cn_date', { length: 10 }).notNull(),
    customerId: uuid('customer_id').notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    subtotal: money('subtotal').notNull().default('0.00'),
    tax: money('tax').notNull().default('0.00'),
    total: money('total').notNull().default('0.00'),
    cogs: money('cogs').notNull().default('0.00'),
    journalEntryId: uuid('journal_entry_id'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_credit_note_company_doc').on(table.companyId, table.docNumber),
    index('idx_credit_note_company_invoice').on(table.companyId, table.invoiceId),
  ],
);

export const creditNoteLines = mysqlTable(
  'credit_note_lines',
  {
    id: uuid('id').primaryKey(),
    cnId: uuid('cn_id').notNull(),
    invoiceLineId: uuid('invoice_line_id'),
    itemId: uuid('item_id').notNull(),
    qty: qty('qty').notNull(),
    unitPrice: money('unit_price').notNull(),
    amount: money('amount').notNull(),
    unitCost: money('unit_cost').notNull().default('0.00'),
    cogsAmount: money('cogs_amount').notNull().default('0.00'),
  },
  (table) => [index('idx_credit_note_line_cn').on(table.cnId)],
);
