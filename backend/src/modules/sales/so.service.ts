import { randomUUID } from 'node:crypto';

import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { itemExists, releaseStockTx, reserveStockTx } from '../inventory/index.ts';
import { fromMinorUnits } from '../../core/money.ts';
import { computeAmounts, lineAmountCents } from './amounts.ts';
import { checkCredit } from './credit.ts';
import { outstandingFor } from './credit.service.ts';
import * as repo from './sales.repository.ts';
import { requireCustomer } from './customer.service.ts';
import { OUTBOX_EVENT_TYPES, QUOTATION_STATUS, SO_STATUS } from './sales.types.ts';

export interface SoLineInput {
  readonly itemId: string;
  readonly qty: string;
  readonly unitPrice: string;
}

export interface CreateSoInput {
  readonly companyId: string;
  readonly soDate: string;
  readonly customerId: string;
  readonly warehouseId: string;
  readonly tax: string;
  readonly lines: readonly SoLineInput[];
  readonly userId: string;
}

export interface SoResult {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
}

async function assertItems(companyId: string, lines: readonly { itemId: string }[]): Promise<void> {
  for (const line of lines) {
    if (!(await itemExists(companyId, line.itemId))) throw new NotFoundError('Item', line.itemId);
  }
}

async function insertSo(tx: Tx, input: CreateSoInput, quotationId: string | null): Promise<SoResult> {
  await assertItems(input.companyId, input.lines);
  const amounts = computeAmounts(input.lines, input.tax);
  const id = randomUUID();
  const period = input.soDate.slice(0, 4);
  const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'SO', prefix: 'SO', period });

  await repo.insertSo(tx, {
    id,
    companyId: input.companyId,
    docNumber,
    soDate: input.soDate,
    customerId: input.customerId,
    warehouseId: input.warehouseId,
    status: SO_STATUS.DRAFT,
    quotationId,
    subtotal: amounts.subtotal,
    tax: amounts.tax,
    total: amounts.total,
    createdBy: input.userId,
  });
  await repo.insertSoLines(
    tx,
    input.lines.map((line) => ({
      id: randomUUID(),
      soId: id,
      itemId: line.itemId,
      qty: line.qty,
      unitPrice: line.unitPrice,
      discount: '0.00',
      subtotal: fromMinorUnits(lineAmountCents(line.qty, line.unitPrice)),
    })),
  );

  await writeOutboxEvent(tx, {
    eventType: OUTBOX_EVENT_TYPES.SO_CREATED,
    aggregateType: 'sales_order',
    aggregateId: id,
    payload: { docNumber, total: amounts.total },
  });
  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    action: 'SO_CREATED',
    entityType: 'sales_order',
    entityId: id,
    stateAfter: { docNumber, total: amounts.total },
  });

  return { id, docNumber, status: SO_STATUS.DRAFT, ...amounts };
}

export async function createSo(input: CreateSoInput): Promise<SoResult> {
  await requireCustomer(input.companyId, input.customerId);
  return runInTransaction((tx) => insertSo(tx, input, null));
}

export interface ConvertQuotationInput {
  readonly companyId: string;
  readonly quotationId: string;
  readonly warehouseId: string;
  readonly soDate: string;
  readonly userId: string;
}

// Converts an ACCEPTED quotation into a DRAFT SO (PRD Story 4.1.1).
export async function convertQuotationToSo(input: ConvertQuotationInput): Promise<SoResult> {
  const quotation = await repo.findQuotation(input.companyId, input.quotationId);
  if (!quotation) throw new NotFoundError('Quotation', input.quotationId);
  if (quotation.status !== QUOTATION_STATUS.ACCEPTED) {
    throw new UnprocessableError(`Quotation berstatus ${quotation.status} belum dapat dikonversi`);
  }
  const quotationLines = await repo.listQuotationLines(input.quotationId);

  return runInTransaction(async (tx) => {
    const result = await insertSo(
      tx,
      {
        companyId: input.companyId,
        soDate: input.soDate,
        customerId: quotation.customerId,
        warehouseId: input.warehouseId,
        tax: quotation.tax,
        lines: quotationLines.map((line) => ({ itemId: line.itemId, qty: line.qty, unitPrice: line.unitPrice })),
        userId: input.userId,
      },
      input.quotationId,
    );
    await repo.updateQuotationStatus(tx, input.quotationId, QUOTATION_STATUS.CONVERTED);
    return result;
  });
}

// Confirms a SO: credit check then soft reserve each line (PRD Story 4.1.2/4.1.3, 4.2.1).
export async function confirmSo(companyId: string, soId: string, userId: string): Promise<SoResult> {
  return runInTransaction(async (tx) => {
    const so = await repo.findSoForUpdate(tx, companyId, soId);
    if (!so) throw new NotFoundError('Sales Order', soId);
    if (so.status !== SO_STATUS.DRAFT) {
      throw new UnprocessableError(`SO berstatus ${so.status} tidak dapat dikonfirmasi`);
    }

    const customer = await requireCustomer(companyId, so.customerId);
    const outstanding = await outstandingFor(tx, companyId, so.customerId);
    const credit = checkCredit({ creditLimit: customer.creditLimit, outstanding, orderTotal: so.total });
    if (!credit.allowed) throw new UnprocessableError('Melebihi credit limit customer');

    const lines = await repo.listSoLinesForUpdate(tx, soId);
    for (const line of lines) {
      await reserveStockTx(tx, {
        companyId,
        itemId: line.itemId,
        warehouseId: so.warehouseId,
        quantity: line.qty,
      });
    }

    await repo.updateSoStatus(tx, soId, SO_STATUS.CONFIRMED);
    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.SO_CONFIRMED,
      aggregateType: 'sales_order',
      aggregateId: soId,
      payload: { docNumber: so.docNumber, total: so.total, reserved: lines.length },
    });
    await writeAuditLog(tx, {
      companyId,
      userId,
      action: 'SO_CONFIRMED',
      entityType: 'sales_order',
      entityId: soId,
      stateBefore: { status: so.status },
      stateAfter: { status: SO_STATUS.CONFIRMED, creditAvailable: credit.available },
    });

    return { id: soId, docNumber: so.docNumber, status: SO_STATUS.CONFIRMED, subtotal: so.subtotal, tax: so.tax, total: so.total };
  });
}

// Cancels a confirmed SO and releases its soft reservation (compensating action).
export async function cancelSo(companyId: string, soId: string, userId: string): Promise<SoResult> {
  return runInTransaction(async (tx) => {
    const so = await repo.findSoForUpdate(tx, companyId, soId);
    if (!so) throw new NotFoundError('Sales Order', soId);
    if (so.status === SO_STATUS.CANCELLED || so.status === SO_STATUS.CLOSED) {
      throw new UnprocessableError(`SO berstatus ${so.status} tidak dapat dibatalkan`);
    }

    if (so.status === SO_STATUS.CONFIRMED) {
      const lines = await repo.listSoLinesForUpdate(tx, soId);
      for (const line of lines) {
        await releaseStockTx(tx, {
          companyId,
          itemId: line.itemId,
          warehouseId: so.warehouseId,
          quantity: line.qty,
        });
      }
    }

    await repo.updateSoStatus(tx, soId, SO_STATUS.CANCELLED);
    await writeAuditLog(tx, {
      companyId,
      userId,
      action: 'SO_CANCELLED',
      entityType: 'sales_order',
      entityId: soId,
      stateBefore: { status: so.status },
      stateAfter: { status: SO_STATUS.CANCELLED },
    });

    return { id: soId, docNumber: so.docNumber, status: SO_STATUS.CANCELLED, subtotal: so.subtotal, tax: so.tax, total: so.total };
  });
}

export function listSos(companyId: string) {
  return repo.listSos(companyId);
}

export async function getSo(companyId: string, id: string) {
  const so = await repo.findSo(companyId, id);
  if (!so) throw new NotFoundError('Sales Order', id);
  const lines = await repo.listSoLines(id);
  return { ...so, lines };
}
