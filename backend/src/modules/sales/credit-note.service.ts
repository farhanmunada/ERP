import { randomUUID } from 'node:crypto';

import { fromMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { JOURNAL_SOURCE, postJournalTx, resolveAccountId } from '../finance/index.ts';
import { computeAmounts, lineAmountCents } from './amounts.ts';
import * as docRepo from './sales-documents.repository.ts';
import {
  AR_ACCOUNT_CODE,
  COGS_ACCOUNT_CODE,
  INVENTORY_ACCOUNT_CODE,
  INVOICE_STATUS,
  OUTBOX_EVENT_TYPES,
  SALES_REVENUE_ACCOUNT_CODE,
} from './sales.types.ts';

export interface CreditNoteLineInput {
  readonly invoiceLineId: string;
  readonly qty: string;
}

export interface CreateCreditNoteInput {
  readonly companyId: string;
  readonly invoiceId: string;
  readonly cnDate: string;
  readonly lines: readonly CreditNoteLineInput[];
  readonly userId: string;
}

export interface CreditNoteResult {
  readonly id: string;
  readonly docNumber: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly cogs: string;
}

interface PreparedLine {
  readonly invoiceLineId: string;
  readonly itemId: string;
  readonly qty: string;
  readonly unitPrice: string;
  readonly unitCost: string;
}

// Validates each returned qty against the invoice line qty.
async function prepareLines(tx: Tx, invoiceId: string, lines: readonly CreditNoteLineInput[]): Promise<PreparedLine[]> {
  const invoiceLines = await docRepo.listInvoiceLines(invoiceId);
  const byId = new Map(invoiceLines.map((line) => [line.id, line]));
  const prepared: PreparedLine[] = [];

  for (const line of lines) {
    const invoiceLine = byId.get(line.invoiceLineId);
    if (!invoiceLine) throw new NotFoundError('Invoice Line', line.invoiceLineId);
    const qty = toQtyUnits(line.qty);
    if (qty <= 0n) throw new UnprocessableError('Kuantitas retur harus lebih dari 0');
    if (qty > toQtyUnits(invoiceLine.qty)) {
      throw new UnprocessableError(`Kuantitas retur melebihi kuantitas invoice (${fromQtyUnits(toQtyUnits(invoiceLine.qty))})`);
    }
    prepared.push({
      invoiceLineId: line.invoiceLineId,
      itemId: invoiceLine.itemId,
      qty: line.qty,
      unitPrice: invoiceLine.unitPrice,
      unitCost: invoiceLine.unitCost,
    });
  }
  return prepared;
}

// Partial return: reverses revenue+AR (at price) and COGS+Inventory (at cost). No physical stock return in P0.
export async function createCreditNote(input: CreateCreditNoteInput): Promise<CreditNoteResult> {
  const invoice = await docRepo.findInvoice(input.companyId, input.invoiceId);
  if (!invoice) throw new NotFoundError('Customer Invoice', input.invoiceId);
  if (invoice.status !== INVOICE_STATUS.POSTED) {
    throw new UnprocessableError(`Invoice berstatus ${invoice.status} tidak dapat diretur`);
  }

  const period = input.cnDate.slice(0, 4);

  return runInTransaction(async (tx) => {
    const prepared = await prepareLines(tx, input.invoiceId, input.lines);
    const amounts = computeAmounts(prepared, '0');
    const cogsCents = prepared.reduce((total, line) => total + lineAmountCents(line.qty, line.unitCost), 0n);

    const id = randomUUID();
    const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'CN', prefix: 'CN', period });

    const journalEntryId = await postCreditNoteJournal(tx, {
      companyId: input.companyId,
      cnId: id,
      docNumber,
      cnDate: input.cnDate,
      subtotal: amounts.subtotal,
      cogs: fromMinorUnits(cogsCents),
      userId: input.userId,
    });

    await docRepo.insertCreditNote(tx, {
      id,
      companyId: input.companyId,
      docNumber,
      cnDate: input.cnDate,
      customerId: invoice.customerId,
      invoiceId: input.invoiceId,
      subtotal: amounts.subtotal,
      tax: '0.00',
      total: amounts.total,
      cogs: fromMinorUnits(cogsCents),
      journalEntryId,
      createdBy: input.userId,
    });
    await docRepo.insertCreditNoteLines(
      tx,
      prepared.map((line) => ({
        id: randomUUID(),
        cnId: id,
        invoiceLineId: line.invoiceLineId,
        itemId: line.itemId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: fromMinorUnits(lineAmountCents(line.qty, line.unitPrice)),
        unitCost: line.unitCost,
        cogsAmount: fromMinorUnits(lineAmountCents(line.qty, line.unitCost)),
      })),
    );

    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.CREDIT_NOTE_POSTED,
      aggregateType: 'credit_note',
      aggregateId: id,
      payload: { docNumber, invoiceId: input.invoiceId, total: amounts.total },
    });
    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: 'CREDIT_NOTE_POSTED',
      entityType: 'credit_note',
      entityId: id,
      stateAfter: { docNumber, invoiceId: input.invoiceId, total: amounts.total },
    });

    return { id, docNumber, subtotal: amounts.subtotal, tax: '0.00', total: amounts.total, cogs: fromMinorUnits(cogsCents) };
  });
}

// Debit Sales + Credit AR (revenue reversal); Debit Inventory + Credit COGS (cost reversal) — PRD Story 5.3.2.
async function postCreditNoteJournal(
  tx: Tx,
  params: {
    readonly companyId: string;
    readonly cnId: string;
    readonly docNumber: string;
    readonly cnDate: string;
    readonly subtotal: string;
    readonly cogs: string;
    readonly userId: string;
  },
): Promise<string> {
  const arAccountId = await resolveAccountId(params.companyId, AR_ACCOUNT_CODE);
  const revenueAccountId = await resolveAccountId(params.companyId, SALES_REVENUE_ACCOUNT_CODE);
  const cogsAccountId = await resolveAccountId(params.companyId, COGS_ACCOUNT_CODE);
  const inventoryAccountId = await resolveAccountId(params.companyId, INVENTORY_ACCOUNT_CODE);

  const journal = await postJournalTx(
    tx,
    {
      companyId: params.companyId,
      entryDate: params.cnDate,
      description: `Nota kredit ${params.docNumber}`,
      sourceType: JOURNAL_SOURCE.SALES,
      sourceId: params.cnId,
      lines: [
        { accountId: revenueAccountId, debit: params.subtotal, credit: '0.00' },
        { accountId: arAccountId, debit: '0.00', credit: params.subtotal },
        { accountId: inventoryAccountId, debit: params.cogs, credit: '0.00' },
        { accountId: cogsAccountId, debit: '0.00', credit: params.cogs },
      ],
    },
    params.userId,
  );
  return journal.id;
}
