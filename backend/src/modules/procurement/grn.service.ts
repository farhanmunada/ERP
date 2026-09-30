import { randomUUID } from 'node:crypto';

import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { stockInTx } from '../inventory/index.ts';
import { JOURNAL_SOURCE, postJournalTx, resolveAccountId } from '../finance/index.ts';
import * as repo from './procurement.repository.ts';
import {
  GRN_ACCRUAL_ACCOUNT_CODE,
  GRN_STATUS,
  INVENTORY_ACCOUNT_CODE,
  OUTBOX_EVENT_TYPES,
  PO_STATUS,
} from './procurement.types.ts';

export interface GrnLineInput {
  readonly poLineId: string;
  readonly qtyReceived: string;
  readonly batchNo?: string | null;
}

export interface CreateGrnInput {
  readonly companyId: string;
  readonly poId: string;
  readonly warehouseId: string;
  readonly grnDate: string;
  readonly lines: readonly GrnLineInput[];
  readonly userId: string;
}

export interface GrnResult {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
  readonly journalEntryId: string | null;
  readonly receivedValue: string;
}

interface PreparedLine {
  readonly poLineId: string;
  readonly itemId: string;
  readonly qtyReceived: string;
  readonly unitCost: string;
  readonly batchNo: string | null;
}

const RECEIVABLE_STATUSES: readonly string[] = [PO_STATUS.APPROVED, PO_STATUS.PARTIALLY_RECEIVED, PO_STATUS.RECEIVED];

// Validates each received line against the PO and prepares unit costs (PRD Story 3.2.2).
async function prepareLines(tx: Tx, input: CreateGrnInput, poId: string): Promise<PreparedLine[]> {
  const poLines = await repo.listPoLinesForUpdate(tx, poId);
  const byId = new Map(poLines.map((line) => [line.id, line]));
  const prepared: PreparedLine[] = [];

  for (const line of input.lines) {
    const poLine = byId.get(line.poLineId);
    if (!poLine) throw new NotFoundError('PO Line', line.poLineId);

    const remaining = toQtyUnits(poLine.qty) - toQtyUnits(poLine.receivedQty);
    const received = toQtyUnits(line.qtyReceived);
    if (received <= 0n) throw new UnprocessableError('Kuantitas diterima harus lebih dari 0');
    if (received > remaining) {
      throw new UnprocessableError(`Kuantitas diterima melebihi sisa PO (${fromQtyUnits(remaining)})`);
    }

    prepared.push({
      poLineId: line.poLineId,
      itemId: poLine.itemId,
      qtyReceived: line.qtyReceived,
      unitCost: poLine.unitPrice,
      batchNo: line.batchNo ?? null,
    });
  }
  return prepared;
}

// Receives goods: increases stock and posts Debit Inventory / Credit GRN Accrual atomically (PRD 3.2.1).
export async function createGrn(input: CreateGrnInput): Promise<GrnResult> {
  const po = await repo.findPo(input.companyId, input.poId);
  if (!po) throw new NotFoundError('Purchase Order', input.poId);
  if (!RECEIVABLE_STATUSES.includes(po.status)) {
    throw new UnprocessableError(`PO berstatus ${po.status} belum dapat diterima`);
  }

  const period = input.grnDate.slice(0, 4);

  return runInTransaction(async (tx) => {
    const prepared = await prepareLines(tx, input, input.poId);
    const id = randomUUID();
    const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'GRN', prefix: 'GRN', period });

    let receivedValueCents = 0n;
    for (const line of prepared) {
      const movement = await stockInTx(tx, {
        companyId: input.companyId,
        itemId: line.itemId,
        warehouseId: input.warehouseId,
        quantity: line.qtyReceived,
        unitCost: line.unitCost,
        referenceType: 'GRN',
        referenceId: id,
        batchNo: line.batchNo,
        userId: input.userId,
      });
      receivedValueCents += toMinorUnits(movement.totalCost);
    }

    const journalEntryId = await postGrnJournal(tx, input, id, docNumber, receivedValueCents);

    await repo.insertGrn(tx, {
      id,
      companyId: input.companyId,
      docNumber,
      grnDate: input.grnDate,
      poId: input.poId,
      warehouseId: input.warehouseId,
      status: GRN_STATUS.POSTED,
      journalEntryId,
      createdBy: input.userId,
    });
    await repo.insertGrnLines(
      tx,
      prepared.map((line) => ({
        id: randomUUID(),
        grnId: id,
        poLineId: line.poLineId,
        itemId: line.itemId,
        qtyReceived: line.qtyReceived,
        unitCost: line.unitCost,
        batchNo: line.batchNo,
      })),
    );

    await applyReceived(tx, input.companyId, input.poId, prepared);

    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.GRN_POSTED,
      aggregateType: 'goods_receipt',
      aggregateId: id,
      payload: { docNumber, poId: input.poId, journalEntryId, receivedValue: fromMinorUnits(receivedValueCents) },
    });
    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: 'GRN_POSTED',
      entityType: 'goods_receipt',
      entityId: id,
      stateAfter: { docNumber, journalEntryId, receivedValue: fromMinorUnits(receivedValueCents) },
    });

    return {
      id,
      docNumber,
      status: GRN_STATUS.POSTED,
      journalEntryId,
      receivedValue: fromMinorUnits(receivedValueCents),
    };
  });
}

// Debit Inventory / Credit GRN Accrual for the value received (PRD 3.2.1).
async function postGrnJournal(
  tx: Tx,
  input: CreateGrnInput,
  grnId: string,
  docNumber: string,
  valueCents: bigint,
): Promise<string | null> {
  if (valueCents === 0n) return null;

  const inventoryAccountId = await resolveAccountId(input.companyId, INVENTORY_ACCOUNT_CODE);
  const accrualAccountId = await resolveAccountId(input.companyId, GRN_ACCRUAL_ACCOUNT_CODE);
  const amount = fromMinorUnits(valueCents);

  const journal = await postJournalTx(
    tx,
    {
      companyId: input.companyId,
      entryDate: input.grnDate,
      description: `Penerimaan barang ${docNumber}`,
      sourceType: JOURNAL_SOURCE.PROCUREMENT,
      sourceId: grnId,
      lines: [
        { accountId: inventoryAccountId, debit: amount, credit: '0.00' },
        { accountId: accrualAccountId, debit: '0.00', credit: amount },
      ],
    },
    input.userId,
  );
  return journal.id;
}

// Adds received quantities to PO lines and flips the PO status (fully vs partially received).
async function applyReceived(tx: Tx, companyId: string, poId: string, prepared: readonly PreparedLine[]): Promise<void> {
  const poLines = await repo.listPoLinesForUpdate(tx, poId);
  const byId = new Map(poLines.map((line) => [line.id, line]));
  for (const line of prepared) {
    const poLine = byId.get(line.poLineId);
    if (!poLine) continue;
    const newReceived = fromQtyUnits(toQtyUnits(poLine.receivedQty) + toQtyUnits(line.qtyReceived));
    await repo.updatePoLine(tx, line.poLineId, { receivedQty: newReceived });
    poLine.receivedQty = newReceived;
  }

  const fullyReceived = poLines.every((line) => toQtyUnits(line.receivedQty) >= toQtyUnits(line.qty));
  const status = fullyReceived ? PO_STATUS.RECEIVED : PO_STATUS.PARTIALLY_RECEIVED;
  await repo.updatePoStatus(tx, poId, { status });
}

export function listGrns(companyId: string) {
  return repo.listGrns(companyId);
}
