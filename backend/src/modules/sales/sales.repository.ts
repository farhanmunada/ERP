import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '../../core/database/client.ts';
import type { Tx } from '../../core/database/transaction.ts';
import {
  customers,
  quotationLines,
  quotations,
  salesOrderLines,
  salesOrders,
} from '../../db/schema/sales.schema.ts';

// --- Customers ---
export async function findCustomerByCode(companyId: string, code: string) {
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.code, code)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findCustomerById(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findCustomerForUpdate(tx: Tx, companyId: string, id: string) {
  const rows = await tx
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.id, id)))
    .for('update');
  return rows[0] ?? null;
}

export async function listCustomers(companyId: string) {
  return db.select().from(customers).where(eq(customers.companyId, companyId)).orderBy(asc(customers.code));
}

export async function insertCustomer(values: typeof customers.$inferInsert) {
  await db.insert(customers).values(values);
}

// --- Quotations ---
export async function insertQuotation(tx: Tx, values: typeof quotations.$inferInsert) {
  await tx.insert(quotations).values(values);
}

export async function insertQuotationLines(tx: Tx, values: (typeof quotationLines.$inferInsert)[]) {
  if (values.length === 0) return;
  await tx.insert(quotationLines).values(values);
}

export async function findQuotation(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(quotations)
    .where(and(eq(quotations.companyId, companyId), eq(quotations.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findQuotationForUpdate(tx: Tx, companyId: string, id: string) {
  const rows = await tx
    .select()
    .from(quotations)
    .where(and(eq(quotations.companyId, companyId), eq(quotations.id, id)))
    .for('update');
  return rows[0] ?? null;
}

export async function listQuotationLines(quotationId: string) {
  return db.select().from(quotationLines).where(eq(quotationLines.quotationId, quotationId)).orderBy(asc(quotationLines.itemId));
}

export async function updateQuotationStatus(tx: Tx, id: string, status: string) {
  await tx.update(quotations).set({ status }).where(eq(quotations.id, id));
}

export async function listQuotations(companyId: string) {
  return db
    .select({
      id: quotations.id,
      docNumber: quotations.docNumber,
      quoteDate: quotations.quoteDate,
      customerId: quotations.customerId,
      customerName: customers.name,
      status: quotations.status,
      subtotal: quotations.subtotal,
      tax: quotations.tax,
      total: quotations.total,
      createdAt: quotations.createdAt,
    })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .where(eq(quotations.companyId, companyId))
    .orderBy(desc(quotations.createdAt));
}

// --- Sales Orders ---
export async function insertSo(tx: Tx, values: typeof salesOrders.$inferInsert) {
  await tx.insert(salesOrders).values(values);
}

export async function insertSoLines(tx: Tx, values: (typeof salesOrderLines.$inferInsert)[]) {
  if (values.length === 0) return;
  await tx.insert(salesOrderLines).values(values);
}

export async function findSo(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(salesOrders)
    .where(and(eq(salesOrders.companyId, companyId), eq(salesOrders.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findSoForUpdate(tx: Tx, companyId: string, id: string) {
  const rows = await tx
    .select()
    .from(salesOrders)
    .where(and(eq(salesOrders.companyId, companyId), eq(salesOrders.id, id)))
    .for('update');
  return rows[0] ?? null;
}

export async function listSoLines(soId: string) {
  return db.select().from(salesOrderLines).where(eq(salesOrderLines.soId, soId)).orderBy(asc(salesOrderLines.itemId));
}

export async function listSoLinesForUpdate(tx: Tx, soId: string) {
  return tx.select().from(salesOrderLines).where(eq(salesOrderLines.soId, soId)).orderBy(asc(salesOrderLines.id)).for('update');
}

export async function updateSoStatus(tx: Tx, id: string, status: string) {
  await tx.update(salesOrders).set({ status }).where(eq(salesOrders.id, id));
}

export async function updateSoLine(tx: Tx, id: string, values: Partial<typeof salesOrderLines.$inferInsert>) {
  await tx.update(salesOrderLines).set(values).where(eq(salesOrderLines.id, id));
}

export async function listSos(companyId: string) {
  return db
    .select({
      id: salesOrders.id,
      docNumber: salesOrders.docNumber,
      soDate: salesOrders.soDate,
      customerId: salesOrders.customerId,
      customerName: customers.name,
      warehouseId: salesOrders.warehouseId,
      status: salesOrders.status,
      total: salesOrders.total,
      createdAt: salesOrders.createdAt,
    })
    .from(salesOrders)
    .innerJoin(customers, eq(customers.id, salesOrders.customerId))
    .where(eq(salesOrders.companyId, companyId))
    .orderBy(desc(salesOrders.createdAt));
}
