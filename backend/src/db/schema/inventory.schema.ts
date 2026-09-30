import { bigint, boolean, index, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

import { createdAt, money, qty, updatedAt, uuid } from './columns.ts';

// Master item. Costing method and batch/serial tracking are configured per item.
export const items = mysqlTable(
  'items',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    code: varchar('code', { length: 30 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    uom: varchar('uom', { length: 20 }).notNull(),
    costingMethod: varchar('costing_method', { length: 20 }).notNull(),
    trackBatch: boolean('track_batch').notNull().default(false),
    trackSerial: boolean('track_serial').notNull().default(false),
    reorderPoint: qty('reorder_point').notNull().default('0.0000'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('uq_item_company_code').on(table.companyId, table.code)],
);

// Current balance per item per warehouse. avg_cost is informational for FIFO items.
export const warehouseStock = mysqlTable(
  'warehouse_stock',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    itemId: uuid('item_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    onHand: qty('on_hand').notNull().default('0.0000'),
    reserved: qty('reserved').notNull().default('0.0000'),
    avgCost: money('avg_cost').notNull().default('0.00'),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_stock_item_warehouse').on(table.itemId, table.warehouseId),
    index('idx_stock_company_warehouse').on(table.companyId, table.warehouseId),
  ],
);

// Append-only stock ledger. Corrections are new rows, never updates/deletes.
// `seq` is an auto-increment counter giving a stable total order even when created_at ties.
export const stockMovements = mysqlTable(
  'stock_movements',
  {
    seq: bigint('seq', { mode: 'number', unsigned: true }).autoincrement().notNull(),
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    itemId: uuid('item_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    movementType: varchar('movement_type', { length: 20 }).notNull(),
    quantity: qty('quantity').notNull(),
    unitCost: money('unit_cost').notNull().default('0.00'),
    totalCost: money('total_cost').notNull().default('0.00'),
    balanceQty: qty('balance_qty').notNull(),
    balanceValue: money('balance_value').notNull().default('0.00'),
    referenceType: varchar('reference_type', { length: 30 }),
    referenceId: varchar('reference_id', { length: 64 }),
    batchNo: varchar('batch_no', { length: 50 }),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_movement_seq').on(table.seq),
    index('idx_movement_company_item').on(table.companyId, table.itemId),
    index('idx_movement_company_created').on(table.companyId, table.createdAt),
  ],
);

// FIFO cost layers (used only when item.costing_method = FIFO).
// `seq` guarantees oldest-layer-first ordering even when two inbound rows share a timestamp.
export const itemCostLayers = mysqlTable(
  'item_cost_layers',
  {
    seq: bigint('seq', { mode: 'number', unsigned: true }).autoincrement().notNull(),
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    itemId: uuid('item_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    quantityRemaining: qty('quantity_remaining').notNull(),
    unitCost: money('unit_cost').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_layer_seq').on(table.seq),
    index('idx_layer_lookup').on(table.itemId, table.warehouseId, table.seq),
  ],
);

// One row per tracked serial unit.
export const itemSerials = mysqlTable(
  'item_serials',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    itemId: uuid('item_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    serialNumber: varchar('serial_number', { length: 80 }).notNull(),
    batchNo: varchar('batch_no', { length: 50 }),
    status: varchar('status', { length: 20 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('uq_serial_company_item_number').on(table.companyId, table.itemId, table.serialNumber)],
);

// Inter-warehouse transfer. Quantity is held as reserved (in-transit) until completed.
export const stockTransfers = mysqlTable(
  'stock_transfers',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    itemId: uuid('item_id').notNull(),
    fromWarehouseId: uuid('from_warehouse_id').notNull(),
    toWarehouseId: uuid('to_warehouse_id').notNull(),
    quantity: qty('quantity').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    completedAt: varchar('completed_at', { length: 30 }),
  },
  (table) => [uniqueIndex('uq_transfer_company_doc').on(table.companyId, table.docNumber)],
);

// Stock opname header + lines (physical count vs system).
export const stockOpnames = mysqlTable(
  'stock_opnames',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    opnameDate: varchar('opname_date', { length: 10 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    journalEntryId: uuid('journal_entry_id'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('uq_opname_company_doc').on(table.companyId, table.docNumber)],
);

export const stockOpnameLines = mysqlTable(
  'stock_opname_lines',
  {
    id: uuid('id').primaryKey(),
    opnameId: uuid('opname_id').notNull(),
    itemId: uuid('item_id').notNull(),
    systemQty: qty('system_qty').notNull(),
    physicalQty: qty('physical_qty').notNull(),
    differenceQty: qty('difference_qty').notNull(),
    unitCost: money('unit_cost').notNull().default('0.00'),
    adjustmentValue: money('adjustment_value').notNull().default('0.00'),
  },
  (table) => [index('idx_opname_line_opname').on(table.opnameId)],
);
