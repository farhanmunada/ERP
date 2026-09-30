import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { db } from '../../core/database/client.ts';
import type { Tx } from '../../core/database/transaction.ts';
import {
  goodsReceiptLines,
  goodsReceipts,
  procurementSettings,
  purchaseOrderLines,
  purchaseOrders,
  purchaseRequisitionLines,
  purchaseRequisitions,
  vendorBillLines,
  vendorBills,
  vendors,
} from '../../db/schema/procurement.schema.ts';

// --- Vendors ---
export async function findVendorByCode(companyId: string, code: string) {
  const rows = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.companyId, companyId), eq(vendors.code, code)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findVendorById(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.companyId, companyId), eq(vendors.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listVendors(companyId: string) {
  return db.select().from(vendors).where(eq(vendors.companyId, companyId)).orderBy(asc(vendors.code));
}

export async function insertVendor(values: typeof vendors.$inferInsert) {
  await db.insert(vendors).values(values);
}

// --- Purchase Requisitions ---
export async function insertPr(tx: Tx, values: typeof purchaseRequisitions.$inferInsert) {
  await tx.insert(purchaseRequisitions).values(values);
}

export async function insertPrLines(tx: Tx, values: (typeof purchaseRequisitionLines.$inferInsert)[]) {
  if (values.length === 0) return;
  await tx.insert(purchaseRequisitionLines).values(values);
}

export async function findPr(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(purchaseRequisitions)
    .where(and(eq(purchaseRequisitions.companyId, companyId), eq(purchaseRequisitions.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findPrForUpdate(tx: Tx, companyId: string, id: string) {
  const rows = await tx
    .select()
    .from(purchaseRequisitions)
    .where(and(eq(purchaseRequisitions.companyId, companyId), eq(purchaseRequisitions.id, id)))
    .for('update');
  return rows[0] ?? null;
}

export async function listPrLines(prId: string) {
  return db.select().from(purchaseRequisitionLines).where(eq(purchaseRequisitionLines.prId, prId));
}

export async function updatePrStatus(tx: Tx, id: string, status: string) {
  await tx.update(purchaseRequisitions).set({ status }).where(eq(purchaseRequisitions.id, id));
}

export async function listPrs(companyId: string) {
  return db
    .select()
    .from(purchaseRequisitions)
    .where(eq(purchaseRequisitions.companyId, companyId))
    .orderBy(desc(purchaseRequisitions.createdAt));
}

// --- Purchase Orders ---
export async function insertPo(tx: Tx, values: typeof purchaseOrders.$inferInsert) {
  await tx.insert(purchaseOrders).values(values);
}

export async function insertPoLines(tx: Tx, values: (typeof purchaseOrderLines.$inferInsert)[]) {
  if (values.length === 0) return;
  await tx.insert(purchaseOrderLines).values(values);
}

export async function findPo(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findPoForUpdate(tx: Tx, companyId: string, id: string) {
  const rows = await tx
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.id, id)))
    .for('update');
  return rows[0] ?? null;
}

export async function listPoLines(poId: string) {
  return db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.poId, poId)).orderBy(asc(purchaseOrderLines.itemId));
}

export async function listPoLinesForUpdate(tx: Tx, poId: string) {
  return tx.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.poId, poId)).orderBy(asc(purchaseOrderLines.id)).for('update');
}

export async function updatePoStatus(
  tx: Tx,
  id: string,
  values: Partial<typeof purchaseOrders.$inferInsert>,
) {
  await tx.update(purchaseOrders).set(values).where(eq(purchaseOrders.id, id));
}

export async function updatePoLine(tx: Tx, id: string, values: Partial<typeof purchaseOrderLines.$inferInsert>) {
  await tx.update(purchaseOrderLines).set(values).where(eq(purchaseOrderLines.id, id));
}

export async function listPos(companyId: string) {
  return db
    .select({
      id: purchaseOrders.id,
      docNumber: purchaseOrders.docNumber,
      poDate: purchaseOrders.poDate,
      vendorId: purchaseOrders.vendorId,
      vendorName: vendors.name,
      warehouseId: purchaseOrders.warehouseId,
      status: purchaseOrders.status,
      total: purchaseOrders.total,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .innerJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
    .where(eq(purchaseOrders.companyId, companyId))
    .orderBy(desc(purchaseOrders.createdAt));
}

export async function findPoLinesByIds(tx: Tx, poLineIds: readonly string[]) {
  if (poLineIds.length === 0) return [];
  return tx.select().from(purchaseOrderLines).where(inArray(purchaseOrderLines.id, [...poLineIds]));
}

// --- Goods Receipts ---
export async function insertGrn(tx: Tx, values: typeof goodsReceipts.$inferInsert) {
  await tx.insert(goodsReceipts).values(values);
}

export async function insertGrnLines(tx: Tx, values: (typeof goodsReceiptLines.$inferInsert)[]) {
  if (values.length === 0) return;
  await tx.insert(goodsReceiptLines).values(values);
}

export async function listGrns(companyId: string) {
  return db
    .select({
      id: goodsReceipts.id,
      docNumber: goodsReceipts.docNumber,
      grnDate: goodsReceipts.grnDate,
      poId: goodsReceipts.poId,
      warehouseId: goodsReceipts.warehouseId,
      status: goodsReceipts.status,
      journalEntryId: goodsReceipts.journalEntryId,
      createdAt: goodsReceipts.createdAt,
    })
    .from(goodsReceipts)
    .where(eq(goodsReceipts.companyId, companyId))
    .orderBy(desc(goodsReceipts.createdAt));
}

// Sum of received qty per PO line, used to compute remaining PO quantity.
export async function sumReceivedByPoLine(tx: Tx, poId: string) {
  const rows = await tx
    .select({ poLineId: goodsReceiptLines.poLineId, qtyReceived: goodsReceiptLines.qtyReceived })
    .from(goodsReceiptLines)
    .innerJoin(goodsReceipts, eq(goodsReceipts.id, goodsReceiptLines.grnId))
    .where(eq(goodsReceipts.poId, poId));
  return rows;
}

// --- Vendor Bills ---
export async function insertBill(tx: Tx, values: typeof vendorBills.$inferInsert) {
  await tx.insert(vendorBills).values(values);
}

export async function insertBillLines(tx: Tx, values: (typeof vendorBillLines.$inferInsert)[]) {
  if (values.length === 0) return;
  await tx.insert(vendorBillLines).values(values);
}

export async function findBill(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(vendorBills)
    .where(and(eq(vendorBills.companyId, companyId), eq(vendorBills.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findBillForUpdate(tx: Tx, companyId: string, id: string) {
  const rows = await tx
    .select()
    .from(vendorBills)
    .where(and(eq(vendorBills.companyId, companyId), eq(vendorBills.id, id)))
    .for('update');
  return rows[0] ?? null;
}

export async function updateBill(tx: Tx, id: string, values: Partial<typeof vendorBills.$inferInsert>) {
  await tx.update(vendorBills).set(values).where(eq(vendorBills.id, id));
}

export async function listBillLines(billId: string) {
  return db.select().from(vendorBillLines).where(eq(vendorBillLines.billId, billId));
}

export async function listBills(companyId: string) {
  return db
    .select({
      id: vendorBills.id,
      docNumber: vendorBills.docNumber,
      billDate: vendorBills.billDate,
      vendorId: vendorBills.vendorId,
      vendorName: vendors.name,
      poId: vendorBills.poId,
      status: vendorBills.status,
      subtotal: vendorBills.subtotal,
      tax: vendorBills.tax,
      total: vendorBills.total,
      createdAt: vendorBills.createdAt,
    })
    .from(vendorBills)
    .innerJoin(vendors, eq(vendors.id, vendorBills.vendorId))
    .where(eq(vendorBills.companyId, companyId))
    .orderBy(desc(vendorBills.createdAt));
}

// Sum of billed qty per PO line across all bills of the PO (used to update billed_qty).
export async function sumBilledByPoLine(tx: Tx, poId: string) {
  const rows = await tx
    .select({ poLineId: vendorBillLines.poLineId, qty: vendorBillLines.qty })
    .from(vendorBillLines)
    .innerJoin(vendorBills, eq(vendorBills.id, vendorBillLines.billId))
    .where(eq(vendorBills.poId, poId));
  return rows;
}

// --- Settings ---
export async function findSettings(companyId: string) {
  const rows = await db.select().from(procurementSettings).where(eq(procurementSettings.companyId, companyId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertSettings(values: typeof procurementSettings.$inferInsert) {
  await db
    .insert(procurementSettings)
    .values(values)
    .onDuplicateKeyUpdate({
      set: { qtyTolerancePct: values.qtyTolerancePct, priceTolerancePct: values.priceTolerancePct },
    });
}
