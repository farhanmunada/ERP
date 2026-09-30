import { boolean, index, int, json, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

import { createdAt, money, qty, updatedAt, uuid } from './columns.ts';

// Master vendor. Payment term is stored in days and used for future AP due-date (P1).
export const vendors = mysqlTable(
  'vendors',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    code: varchar('code', { length: 30 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    email: varchar('email', { length: 150 }),
    phone: varchar('phone', { length: 30 }),
    address: varchar('address', { length: 255 }),
    npwp: varchar('npwp', { length: 30 }),
    paymentTermDays: int('payment_term_days').notNull().default(30),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('uq_vendor_company_code').on(table.companyId, table.code)],
);

// Purchase Requisition header. Lightweight: DRAFT -> APPROVED -> CONVERTED.
export const purchaseRequisitions = mysqlTable(
  'purchase_requisitions',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    prDate: varchar('pr_date', { length: 10 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    notes: varchar('notes', { length: 255 }),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('uq_pr_company_doc').on(table.companyId, table.docNumber)],
);

export const purchaseRequisitionLines = mysqlTable(
  'purchase_requisition_lines',
  {
    id: uuid('id').primaryKey(),
    prId: uuid('pr_id').notNull(),
    itemId: uuid('item_id').notNull(),
    qty: qty('qty').notNull(),
    notes: varchar('notes', { length: 255 }),
  },
  (table) => [index('idx_pr_line_pr').on(table.prId)],
);

// Purchase Order header. Amounts drive the multi-tier approval matrix.
export const purchaseOrders = mysqlTable(
  'purchase_orders',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    poDate: varchar('po_date', { length: 10 }).notNull(),
    vendorId: uuid('vendor_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    prId: uuid('pr_id'),
    subtotal: money('subtotal').notNull().default('0.00'),
    tax: money('tax').notNull().default('0.00'),
    total: money('total').notNull().default('0.00'),
    approvalRequestId: uuid('approval_request_id'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_po_company_doc').on(table.companyId, table.docNumber),
    index('idx_po_company_vendor').on(table.companyId, table.vendorId),
  ],
);

// received_qty/billed_qty accumulate across partial GRNs and bills (PRD 3.2.2).
export const purchaseOrderLines = mysqlTable(
  'purchase_order_lines',
  {
    id: uuid('id').primaryKey(),
    poId: uuid('po_id').notNull(),
    itemId: uuid('item_id').notNull(),
    qty: qty('qty').notNull(),
    unitPrice: money('unit_price').notNull(),
    receivedQty: qty('received_qty').notNull().default('0.0000'),
    billedQty: qty('billed_qty').notNull().default('0.0000'),
  },
  (table) => [index('idx_po_line_po').on(table.poId)],
);

// Goods Receipt. Posts stock-in + journal (Debit Inventory / Credit GRN Accrual) atomically.
export const goodsReceipts = mysqlTable(
  'goods_receipts',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    grnDate: varchar('grn_date', { length: 10 }).notNull(),
    poId: uuid('po_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    journalEntryId: uuid('journal_entry_id'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_grn_company_doc').on(table.companyId, table.docNumber),
    index('idx_grn_company_po').on(table.companyId, table.poId),
  ],
);

export const goodsReceiptLines = mysqlTable(
  'goods_receipt_lines',
  {
    id: uuid('id').primaryKey(),
    grnId: uuid('grn_id').notNull(),
    poLineId: uuid('po_line_id').notNull(),
    itemId: uuid('item_id').notNull(),
    qtyReceived: qty('qty_received').notNull(),
    unitCost: money('unit_cost').notNull(),
    batchNo: varchar('batch_no', { length: 50 }),
  },
  (table) => [index('idx_grn_line_grn').on(table.grnId)],
);

// Vendor Bill. match_result holds the 3-way matching outcome as JSON.
export const vendorBills = mysqlTable(
  'vendor_bills',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    billDate: varchar('bill_date', { length: 10 }).notNull(),
    vendorId: uuid('vendor_id').notNull(),
    poId: uuid('po_id'),
    status: varchar('status', { length: 20 }).notNull(),
    subtotal: money('subtotal').notNull().default('0.00'),
    tax: money('tax').notNull().default('0.00'),
    total: money('total').notNull().default('0.00'),
    matchResult: json('match_result'),
    overrideReason: varchar('override_reason', { length: 255 }),
    overriddenBy: uuid('overridden_by'),
    journalEntryId: uuid('journal_entry_id'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_bill_company_doc').on(table.companyId, table.docNumber),
    index('idx_bill_company_vendor').on(table.companyId, table.vendorId),
  ],
);

export const vendorBillLines = mysqlTable(
  'vendor_bill_lines',
  {
    id: uuid('id').primaryKey(),
    billId: uuid('bill_id').notNull(),
    poLineId: uuid('po_line_id'),
    itemId: uuid('item_id').notNull(),
    qty: qty('qty').notNull(),
    unitPrice: money('unit_price').notNull(),
    amount: money('amount').notNull(),
  },
  (table) => [index('idx_bill_line_bill').on(table.billId)],
);

// Per-company matching tolerance (percent). Defaults to 2% qty / 2% price.
export const procurementSettings = mysqlTable('procurement_settings', {
  companyId: uuid('company_id').primaryKey(),
  qtyTolerancePct: money('qty_tolerance_pct').notNull().default('2.00'),
  priceTolerancePct: money('price_tolerance_pct').notNull().default('2.00'),
  updatedAt: updatedAt(),
});
