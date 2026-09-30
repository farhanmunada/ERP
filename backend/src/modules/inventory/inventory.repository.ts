import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { db } from '../../core/database/client.ts';
import type { Tx } from '../../core/database/transaction.ts';
import {
  itemCostLayers,
  itemSerials,
  items,
  stockMovements,
  stockOpnameLines,
  stockOpnames,
  stockTransfers,
  warehouseStock,
} from '../../db/schema/inventory.schema.ts';

// --- Items ---
export async function findItemByCode(companyId: string, code: string) {
  const rows = await db
    .select()
    .from(items)
    .where(and(eq(items.companyId, companyId), eq(items.code, code)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findItemById(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(items)
    .where(and(eq(items.companyId, companyId), eq(items.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listItems(companyId: string) {
  return db.select().from(items).where(eq(items.companyId, companyId)).orderBy(asc(items.code));
}

export async function insertItem(values: typeof items.$inferInsert) {
  await db.insert(items).values(values);
}

export async function updateItem(companyId: string, id: string, values: Partial<typeof items.$inferInsert>) {
  await db.update(items).set(values).where(and(eq(items.companyId, companyId), eq(items.id, id)));
}

// --- Stock balances ---
export async function lockStock(tx: Tx, itemId: string, warehouseId: string) {
  const rows = await tx
    .select()
    .from(warehouseStock)
    .where(and(eq(warehouseStock.itemId, itemId), eq(warehouseStock.warehouseId, warehouseId)))
    .for('update');
  return rows[0] ?? null;
}

export async function insertStock(tx: Tx, values: typeof warehouseStock.$inferInsert) {
  await tx.insert(warehouseStock).values(values);
}

export async function updateStock(
  tx: Tx,
  id: string,
  values: Partial<typeof warehouseStock.$inferInsert>,
) {
  await tx.update(warehouseStock).set(values).where(eq(warehouseStock.id, id));
}

export interface StockFilter {
  readonly itemId?: string;
  readonly warehouseId?: string;
  readonly onlyPositive?: boolean;
}

export async function listStock(companyId: string, filter: StockFilter) {
  const conditions: SQL[] = [eq(warehouseStock.companyId, companyId)];
  if (filter.itemId) conditions.push(eq(warehouseStock.itemId, filter.itemId));
  if (filter.warehouseId) conditions.push(eq(warehouseStock.warehouseId, filter.warehouseId));
  if (filter.onlyPositive) conditions.push(gte(warehouseStock.onHand, '0.0001'));

  return db
    .select({
      id: warehouseStock.id,
      itemId: warehouseStock.itemId,
      itemCode: items.code,
      itemName: items.name,
      uom: items.uom,
      warehouseId: warehouseStock.warehouseId,
      onHand: warehouseStock.onHand,
      reserved: warehouseStock.reserved,
      avgCost: warehouseStock.avgCost,
      updatedAt: warehouseStock.updatedAt,
    })
    .from(warehouseStock)
    .innerJoin(items, eq(items.id, warehouseStock.itemId))
    .where(and(...conditions))
    .orderBy(asc(items.code));
}

// --- Movements (append-only) ---
export async function insertMovement(tx: Tx, values: typeof stockMovements.$inferInsert) {
  await tx.insert(stockMovements).values(values);
}

export interface MovementFilter {
  readonly itemId?: string;
  readonly warehouseId?: string;
  readonly movementType?: string;
  readonly limit?: number;
}

export async function listMovements(companyId: string, filter: MovementFilter) {
  const conditions: SQL[] = [eq(stockMovements.companyId, companyId)];
  if (filter.itemId) conditions.push(eq(stockMovements.itemId, filter.itemId));
  if (filter.warehouseId) conditions.push(eq(stockMovements.warehouseId, filter.warehouseId));
  if (filter.movementType) conditions.push(eq(stockMovements.movementType, filter.movementType));

  return db
    .select({
      id: stockMovements.id,
      itemId: stockMovements.itemId,
      itemCode: items.code,
      itemName: items.name,
      warehouseId: stockMovements.warehouseId,
      movementType: stockMovements.movementType,
      quantity: stockMovements.quantity,
      unitCost: stockMovements.unitCost,
      totalCost: stockMovements.totalCost,
      balanceQty: stockMovements.balanceQty,
      balanceValue: stockMovements.balanceValue,
      referenceType: stockMovements.referenceType,
      referenceId: stockMovements.referenceId,
      batchNo: stockMovements.batchNo,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .innerJoin(items, eq(items.id, stockMovements.itemId))
    .where(and(...conditions))
    .orderBy(desc(stockMovements.seq))
    .limit(filter.limit ?? 200);
}

// --- FIFO layers ---
export async function lockCostLayers(tx: Tx, itemId: string, warehouseId: string) {
  return tx
    .select()
    .from(itemCostLayers)
    .where(and(eq(itemCostLayers.itemId, itemId), eq(itemCostLayers.warehouseId, warehouseId)))
    .orderBy(asc(itemCostLayers.seq))
    .for('update');
}

export async function insertCostLayer(tx: Tx, values: typeof itemCostLayers.$inferInsert) {
  await tx.insert(itemCostLayers).values(values);
}

export async function setLayerRemaining(tx: Tx, id: string, quantityRemaining: string) {
  await tx.update(itemCostLayers).set({ quantityRemaining }).where(eq(itemCostLayers.id, id));
}

// --- Serial numbers ---
export async function insertSerial(tx: Tx, values: typeof itemSerials.$inferInsert) {
  await tx.insert(itemSerials).values(values);
}

export async function lockSerials(tx: Tx, companyId: string, itemId: string, serialNumbers: readonly string[]) {
  if (serialNumbers.length === 0) return [];
  return tx
    .select()
    .from(itemSerials)
    .where(
      and(
        eq(itemSerials.companyId, companyId),
        eq(itemSerials.itemId, itemId),
        inArray(itemSerials.serialNumber, [...serialNumbers]),
      ),
    )
    .for('update');
}

export async function markSerialsIssued(tx: Tx, ids: readonly string[]) {
  if (ids.length === 0) return;
  await tx.update(itemSerials).set({ status: 'ISSUED' }).where(inArray(itemSerials.id, [...ids]));
}

// --- Transfers ---
export async function insertTransfer(tx: Tx, values: typeof stockTransfers.$inferInsert) {
  await tx.insert(stockTransfers).values(values);
}

export async function findTransferForUpdate(tx: Tx, companyId: string, id: string) {
  const rows = await tx
    .select()
    .from(stockTransfers)
    .where(and(eq(stockTransfers.companyId, companyId), eq(stockTransfers.id, id)))
    .for('update');
  return rows[0] ?? null;
}

export async function findTransfer(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(stockTransfers)
    .where(and(eq(stockTransfers.companyId, companyId), eq(stockTransfers.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listTransfers(companyId: string, status?: string) {
  const conditions: SQL[] = [eq(stockTransfers.companyId, companyId)];
  if (status) conditions.push(eq(stockTransfers.status, status));
  return db
    .select()
    .from(stockTransfers)
    .where(and(...conditions))
    .orderBy(desc(stockTransfers.createdAt));
}

export async function completeTransferRow(tx: Tx, id: string, completedAt: string) {
  await tx
    .update(stockTransfers)
    .set({ status: 'COMPLETED', completedAt })
    .where(eq(stockTransfers.id, id));
}

// --- Opname ---
export async function insertOpname(tx: Tx, values: typeof stockOpnames.$inferInsert) {
  await tx.insert(stockOpnames).values(values);
}

export async function insertOpnameLines(tx: Tx, values: (typeof stockOpnameLines.$inferInsert)[]) {
  if (values.length === 0) return;
  await tx.insert(stockOpnameLines).values(values);
}

export async function listOpnames(companyId: string, warehouseId?: string, from?: string, to?: string) {
  const conditions: SQL[] = [eq(stockOpnames.companyId, companyId)];
  if (warehouseId) conditions.push(eq(stockOpnames.warehouseId, warehouseId));
  if (from) conditions.push(gte(stockOpnames.opnameDate, from));
  if (to) conditions.push(lte(stockOpnames.opnameDate, to));
  return db
    .select()
    .from(stockOpnames)
    .where(and(...conditions))
    .orderBy(desc(stockOpnames.createdAt));
}
