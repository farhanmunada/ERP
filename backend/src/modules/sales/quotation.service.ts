import { randomUUID } from 'node:crypto';

import { fromMinorUnits } from '../../core/money.ts';
import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { itemExists } from '../inventory/index.ts';
import { computeAmounts, lineAmountCents } from './amounts.ts';
import * as repo from './sales.repository.ts';
import { requireCustomer } from './customer.service.ts';
import { OUTBOX_EVENT_TYPES, QUOTATION_STATUS } from './sales.types.ts';

export interface QuotationLineInput {
  readonly itemId: string;
  readonly qty: string;
  readonly unitPrice: string;
}

export interface CreateQuotationInput {
  readonly companyId: string;
  readonly quoteDate: string;
  readonly customerId: string;
  readonly validUntil?: string | null;
  readonly tax: string;
  readonly lines: readonly QuotationLineInput[];
  readonly userId: string;
}

export interface QuotationResult {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
}

async function assertItems(companyId: string, lines: readonly QuotationLineInput[]): Promise<void> {
  for (const line of lines) {
    if (!(await itemExists(companyId, line.itemId))) throw new NotFoundError('Item', line.itemId);
  }
}

export async function createQuotation(input: CreateQuotationInput): Promise<QuotationResult> {
  await requireCustomer(input.companyId, input.customerId);
  await assertItems(input.companyId, input.lines);

  const amounts = computeAmounts(input.lines, input.tax);
  const period = input.quoteDate.slice(0, 4);

  return runInTransaction(async (tx) => {
    const id = randomUUID();
    const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'QT', prefix: 'QT', period });

    await repo.insertQuotation(tx, {
      id,
      companyId: input.companyId,
      docNumber,
      quoteDate: input.quoteDate,
      customerId: input.customerId,
      status: QUOTATION_STATUS.DRAFT,
      subtotal: amounts.subtotal,
      tax: amounts.tax,
      total: amounts.total,
      validUntil: input.validUntil ?? null,
      createdBy: input.userId,
    });
    await repo.insertQuotationLines(
      tx,
      input.lines.map((line) => ({
        id: randomUUID(),
        quotationId: id,
        itemId: line.itemId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discount: '0.00',
        subtotal: fromMinorUnits(lineAmountCents(line.qty, line.unitPrice)),
      })),
    );

    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.QUOTATION_CREATED,
      aggregateType: 'quotation',
      aggregateId: id,
      payload: { docNumber, total: amounts.total },
    });
    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: 'QUOTATION_CREATED',
      entityType: 'quotation',
      entityId: id,
      stateAfter: { docNumber, total: amounts.total },
    });

    return { id, docNumber, status: QUOTATION_STATUS.DRAFT, ...amounts };
  });
}

// Accepts a quotation (DRAFT -> ACCEPTED) so it can be converted into a Sales Order.
export async function acceptQuotation(companyId: string, id: string, userId: string): Promise<QuotationResult> {
  return runInTransaction(async (tx) => {
    const quotation = await repo.findQuotationForUpdate(tx, companyId, id);
    if (!quotation) throw new NotFoundError('Quotation', id);
    if (quotation.status !== QUOTATION_STATUS.DRAFT) {
      throw new UnprocessableError(`Quotation berstatus ${quotation.status} tidak dapat diterima`);
    }
    await repo.updateQuotationStatus(tx, id, QUOTATION_STATUS.ACCEPTED);
    await writeAuditLog(tx, {
      companyId,
      userId,
      action: 'QUOTATION_ACCEPTED',
      entityType: 'quotation',
      entityId: id,
      stateBefore: { status: quotation.status },
      stateAfter: { status: QUOTATION_STATUS.ACCEPTED },
    });
    return {
      id,
      docNumber: quotation.docNumber,
      status: QUOTATION_STATUS.ACCEPTED,
      subtotal: quotation.subtotal,
      tax: quotation.tax,
      total: quotation.total,
    };
  });
}

export function listQuotations(companyId: string) {
  return repo.listQuotations(companyId);
}

export async function getQuotation(companyId: string, id: string) {
  const quotation = await repo.findQuotation(companyId, id);
  if (!quotation) throw new NotFoundError('Quotation', id);
  const lines = await repo.listQuotationLines(id);
  return { ...quotation, lines };
}
