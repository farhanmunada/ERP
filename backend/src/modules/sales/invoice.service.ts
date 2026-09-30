import { randomUUID } from 'node:crypto';

import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { JOURNAL_SOURCE, postJournalTx, resolveAccountId, reverseJournalTx } from '../finance/index.ts';
import { computeAmounts, lineAmountCents } from './amounts.ts';
import * as repo from './sales.repository.ts';
import * as docRepo from './sales-documents.repository.ts';
import { requireCustomer } from './customer.service.ts';
import {
  AR_ACCOUNT_CODE,
  COGS_ACCOUNT_CODE,
  INVENTORY_ACCOUNT_CODE,
  INVOICE_STATUS,
  OUTBOX_EVENT_TYPES,
  PPN_OUTPUT_ACCOUNT_CODE,
  SALES_REVENUE_ACCOUNT_CODE,
  SO_STATUS,
} from './sales.types.ts';

export interface CreateInvoiceInput {
  readonly companyId: string;
  readonly doId: string;
  readonly invoiceDate: string;
  readonly tax: string;
  readonly userId: string;
}

export interface InvoiceResult {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly cogs: string;
}

interface InvoiceLine {
  readonly soLineId: string;
  readonly itemId: string;
  readonly qty: string;
  readonly unitPrice: string;
  readonly unitCost: string;
}

// Builds invoice lines from the delivery: qty from DO, price from SO, cost from DO (PRD Story 4.3).
async function buildLines(tx: Tx, doId: string, soId: string): Promise<InvoiceLine[]> {
  const doLines = await docRepo.listDoLines(doId);
  const soLines = await repo.listSoLinesForUpdate(tx, soId);
  const priceBySoLine = new Map(soLines.map((line) => [line.id, line.unitPrice]));

  return doLines.map((line) => ({
    soLineId: line.soLineId,
    itemId: line.itemId,
    qty: line.qtyDelivered,
    unitPrice: priceBySoLine.get(line.soLineId) ?? '0.00',
    unitCost: line.unitCost,
  }));
}

// Posts a Customer Invoice: AR/revenue (+PPN) and COGS/Inventory in one atomic journal (PRD Story 4.3.1).
export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceResult> {
  const delivery = await docRepo.findDo(input.companyId, input.doId);
  if (!delivery) throw new NotFoundError('Delivery Order', input.doId);
  const so = await repo.findSo(input.companyId, delivery.soId);
  if (!so) throw new NotFoundError('Sales Order', delivery.soId);
  await requireCustomer(input.companyId, so.customerId);

  const period = input.invoiceDate.slice(0, 4);

  return runInTransaction(async (tx) => {
    const lines = await buildLines(tx, input.doId, delivery.soId);
    if (lines.length === 0) throw new UnprocessableError('Delivery tidak memiliki baris');

    const amounts = computeAmounts(lines, input.tax);
    const cogsCents = lines.reduce((total, line) => total + lineAmountCents(line.qty, line.unitCost), 0n);

    const id = randomUUID();
    const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'INV', prefix: 'INV', period });

    const journalEntryId = await postInvoiceJournal(tx, {
      companyId: input.companyId,
      invoiceId: id,
      docNumber,
      invoiceDate: input.invoiceDate,
      subtotal: amounts.subtotal,
      tax: amounts.tax,
      total: amounts.total,
      cogs: fromMinorUnits(cogsCents),
      userId: input.userId,
    });

    await docRepo.insertInvoice(tx, {
      id,
      companyId: input.companyId,
      docNumber,
      invoiceDate: input.invoiceDate,
      customerId: so.customerId,
      doId: input.doId,
      status: INVOICE_STATUS.POSTED,
      subtotal: amounts.subtotal,
      tax: amounts.tax,
      total: amounts.total,
      cogs: fromMinorUnits(cogsCents),
      journalEntryId,
      createdBy: input.userId,
    });
    await docRepo.insertInvoiceLines(
      tx,
      lines.map((line) => ({
        id: randomUUID(),
        invoiceId: id,
        soLineId: line.soLineId,
        itemId: line.itemId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: fromMinorUnits(lineAmountCents(line.qty, line.unitPrice)),
        unitCost: line.unitCost,
        cogsAmount: fromMinorUnits(lineAmountCents(line.qty, line.unitCost)),
      })),
    );

    await applyInvoiced(tx, delivery.soId, lines);

    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.INVOICE_POSTED,
      aggregateType: 'customer_invoice',
      aggregateId: id,
      payload: { docNumber, journalEntryId, total: amounts.total, cogs: fromMinorUnits(cogsCents) },
    });
    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: 'INVOICE_POSTED',
      entityType: 'customer_invoice',
      entityId: id,
      stateAfter: { docNumber, journalEntryId, total: amounts.total },
    });

    return { id, docNumber, status: INVOICE_STATUS.POSTED, subtotal: amounts.subtotal, tax: amounts.tax, total: amounts.total, cogs: fromMinorUnits(cogsCents) };
  });
}

// AR (total) / Sales (subtotal) + PPN Keluaran (tax) and COGS / Inventory — one balanced journal.
async function postInvoiceJournal(
  tx: Tx,
  params: {
    readonly companyId: string;
    readonly invoiceId: string;
    readonly docNumber: string;
    readonly invoiceDate: string;
    readonly subtotal: string;
    readonly tax: string;
    readonly total: string;
    readonly cogs: string;
    readonly userId: string;
  },
): Promise<string> {
  const arAccountId = await resolveAccountId(params.companyId, AR_ACCOUNT_CODE);
  const revenueAccountId = await resolveAccountId(params.companyId, SALES_REVENUE_ACCOUNT_CODE);
  const cogsAccountId = await resolveAccountId(params.companyId, COGS_ACCOUNT_CODE);
  const inventoryAccountId = await resolveAccountId(params.companyId, INVENTORY_ACCOUNT_CODE);

  const lines = [
    { accountId: arAccountId, debit: params.total, credit: '0.00' },
    { accountId: revenueAccountId, debit: '0.00', credit: params.subtotal },
  ];
  if (toMinorUnits(params.tax) > 0n) {
    const ppnAccountId = await resolveAccountId(params.companyId, PPN_OUTPUT_ACCOUNT_CODE);
    lines.push({ accountId: ppnAccountId, debit: '0.00', credit: params.tax });
  }
  lines.push({ accountId: cogsAccountId, debit: params.cogs, credit: '0.00' });
  lines.push({ accountId: inventoryAccountId, debit: '0.00', credit: params.cogs });

  const journal = await postJournalTx(
    tx,
    {
      companyId: params.companyId,
      entryDate: params.invoiceDate,
      description: `Faktur penjualan ${params.docNumber}`,
      sourceType: JOURNAL_SOURCE.SALES,
      sourceId: params.invoiceId,
      lines,
    },
    params.userId,
  );
  return journal.id;
}

// Increments invoiced_qty on SO lines and flips SO to INVOICED when fully invoiced.
async function applyInvoiced(tx: Tx, soId: string, lines: readonly InvoiceLine[]): Promise<void> {
  const soLines = await repo.listSoLinesForUpdate(tx, soId);
  const byId = new Map(soLines.map((line) => [line.id, line]));
  for (const line of lines) {
    const soLine = byId.get(line.soLineId);
    if (!soLine) continue;
    const newInvoiced = fromQtyUnits(toQtyUnits(soLine.invoicedQty) + toQtyUnits(line.qty));
    await repo.updateSoLine(tx, line.soLineId, { invoicedQty: newInvoiced });
    soLine.invoicedQty = newInvoiced;
  }

  const fullyInvoiced = soLines.every((line) => toQtyUnits(line.invoicedQty) >= toQtyUnits(line.deliveredQty));
  if (fullyInvoiced) await repo.updateSoStatus(tx, soId, SO_STATUS.INVOICED);
}

// Voids a posted invoice by creating a reversal journal (original stays immutable) — PRD Story 5.3.1.
export async function voidInvoice(companyId: string, invoiceId: string, userId: string): Promise<InvoiceResult> {
  const invoice = await docRepo.findInvoice(companyId, invoiceId);
  if (!invoice) throw new NotFoundError('Customer Invoice', invoiceId);
  if (invoice.status !== INVOICE_STATUS.POSTED) {
    throw new UnprocessableError(`Invoice berstatus ${invoice.status} tidak dapat di-void`);
  }

  return runInTransaction(async (tx) => {
    const locked = await docRepo.findInvoiceForUpdate(tx, companyId, invoiceId);
    if (!locked) throw new NotFoundError('Customer Invoice', invoiceId);
    if (locked.status !== INVOICE_STATUS.POSTED) {
      throw new UnprocessableError(`Invoice berstatus ${locked.status} tidak dapat di-void`);
    }

    if (locked.journalEntryId) {
      await reverseJournalTx(tx, companyId, locked.journalEntryId, userId);
    }
    await docRepo.updateInvoice(tx, invoiceId, { status: INVOICE_STATUS.VOID });

    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.INVOICE_VOIDED,
      aggregateType: 'customer_invoice',
      aggregateId: invoiceId,
      payload: { docNumber: locked.docNumber },
    });
    await writeAuditLog(tx, {
      companyId,
      userId,
      action: 'INVOICE_VOIDED',
      entityType: 'customer_invoice',
      entityId: invoiceId,
      stateBefore: { status: locked.status },
      stateAfter: { status: INVOICE_STATUS.VOID },
    });

    return { id: invoiceId, docNumber: locked.docNumber, status: INVOICE_STATUS.VOID, subtotal: locked.subtotal, tax: locked.tax, total: locked.total, cogs: locked.cogs };
  });
}

export function listInvoices(companyId: string) {
  return docRepo.listInvoices(companyId);
}

export async function getInvoice(companyId: string, id: string) {
  const invoice = await docRepo.findInvoice(companyId, id);
  if (!invoice) throw new NotFoundError('Customer Invoice', id);
  const lines = await docRepo.listInvoiceLines(id);
  return { ...invoice, lines };
}
