import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '../../core/database/client.ts';
import type { Tx } from '../../core/database/transaction.ts';
import {
  creditNoteLines,
  creditNotes,
  customerInvoiceLines,
  customerInvoices,
  customers,
  deliveryOrderLines,
  deliveryOrders,
  salesOrders,
} from '../../db/schema/sales.schema.ts';

// --- Delivery Orders ---
export async function insertDo(tx: Tx, values: typeof deliveryOrders.$inferInsert) {
  await tx.insert(deliveryOrders).values(values);
}

export async function insertDoLines(tx: Tx, values: (typeof deliveryOrderLines.$inferInsert)[]) {
  if (values.length === 0) return;
  await tx.insert(deliveryOrderLines).values(values);
}

export async function findDo(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(deliveryOrders)
    .where(and(eq(deliveryOrders.companyId, companyId), eq(deliveryOrders.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDoLines(doId: string) {
  return db.select().from(deliveryOrderLines).where(eq(deliveryOrderLines.doId, doId)).orderBy(asc(deliveryOrderLines.itemId));
}

export async function listDos(companyId: string) {
  return db
    .select({
      id: deliveryOrders.id,
      docNumber: deliveryOrders.docNumber,
      doDate: deliveryOrders.doDate,
      soId: deliveryOrders.soId,
      soDocNumber: salesOrders.docNumber,
      warehouseId: deliveryOrders.warehouseId,
      status: deliveryOrders.status,
      createdAt: deliveryOrders.createdAt,
    })
    .from(deliveryOrders)
    .innerJoin(salesOrders, eq(salesOrders.id, deliveryOrders.soId))
    .where(eq(deliveryOrders.companyId, companyId))
    .orderBy(desc(deliveryOrders.createdAt));
}

// Sum of delivered qty per SO line across all DOs (used to update delivered_qty).
export async function sumDeliveredBySoLine(tx: Tx, soId: string) {
  const rows = await tx
    .select({ soLineId: deliveryOrderLines.soLineId, qty: deliveryOrderLines.qtyDelivered })
    .from(deliveryOrderLines)
    .innerJoin(deliveryOrders, eq(deliveryOrders.id, deliveryOrderLines.doId))
    .where(eq(deliveryOrders.soId, soId));
  return rows;
}

// --- Customer Invoices ---
export async function insertInvoice(tx: Tx, values: typeof customerInvoices.$inferInsert) {
  await tx.insert(customerInvoices).values(values);
}

export async function insertInvoiceLines(tx: Tx, values: (typeof customerInvoiceLines.$inferInsert)[]) {
  if (values.length === 0) return;
  await tx.insert(customerInvoiceLines).values(values);
}

export async function findInvoice(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(customerInvoices)
    .where(and(eq(customerInvoices.companyId, companyId), eq(customerInvoices.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findInvoiceForUpdate(tx: Tx, companyId: string, id: string) {
  const rows = await tx
    .select()
    .from(customerInvoices)
    .where(and(eq(customerInvoices.companyId, companyId), eq(customerInvoices.id, id)))
    .for('update');
  return rows[0] ?? null;
}

export async function updateInvoice(tx: Tx, id: string, values: Partial<typeof customerInvoices.$inferInsert>) {
  await tx.update(customerInvoices).set(values).where(eq(customerInvoices.id, id));
}

export async function listInvoiceLines(invoiceId: string) {
  return db.select().from(customerInvoiceLines).where(eq(customerInvoiceLines.invoiceId, invoiceId));
}

export async function listInvoices(companyId: string) {
  return db
    .select({
      id: customerInvoices.id,
      docNumber: customerInvoices.docNumber,
      invoiceDate: customerInvoices.invoiceDate,
      customerId: customerInvoices.customerId,
      customerName: customers.name,
      status: customerInvoices.status,
      subtotal: customerInvoices.subtotal,
      tax: customerInvoices.tax,
      total: customerInvoices.total,
      cogs: customerInvoices.cogs,
      createdAt: customerInvoices.createdAt,
    })
    .from(customerInvoices)
    .innerJoin(customers, eq(customers.id, customerInvoices.customerId))
    .where(eq(customerInvoices.companyId, companyId))
    .orderBy(desc(customerInvoices.createdAt));
}

// Sum of POSTED invoice totals per customer, used for the credit check.
export async function sumOutstandingByCustomer(tx: Tx, companyId: string, customerId: string) {
  const rows = await tx
    .select({ total: customerInvoices.total, status: customerInvoices.status })
    .from(customerInvoices)
    .where(and(eq(customerInvoices.companyId, companyId), eq(customerInvoices.customerId, customerId)));
  return rows;
}

// --- Credit Notes ---
export async function insertCreditNote(tx: Tx, values: typeof creditNotes.$inferInsert) {
  await tx.insert(creditNotes).values(values);
}

export async function insertCreditNoteLines(tx: Tx, values: (typeof creditNoteLines.$inferInsert)[]) {
  if (values.length === 0) return;
  await tx.insert(creditNoteLines).values(values);
}

export async function findCreditNote(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(creditNotes)
    .where(and(eq(creditNotes.companyId, companyId), eq(creditNotes.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listCreditNoteLines(cnId: string) {
  return db.select().from(creditNoteLines).where(eq(creditNoteLines.cnId, cnId));
}

// Sum of credit note totals per customer (netted against outstanding AR).
export async function sumCreditNotesByCustomer(tx: Tx, companyId: string, customerId: string) {
  const rows = await tx
    .select({ total: creditNotes.total })
    .from(creditNotes)
    .where(and(eq(creditNotes.companyId, companyId), eq(creditNotes.customerId, customerId)));
  return rows;
}
