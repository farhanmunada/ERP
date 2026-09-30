import { randomUUID } from 'node:crypto';

import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { releaseStockTx, stockOutTx } from '../inventory/index.ts';
import type { deliveryOrderLines } from '../../db/schema/sales.schema.ts';
import * as repo from './sales.repository.ts';
import * as docRepo from './sales-documents.repository.ts';
import { DO_STATUS, OUTBOX_EVENT_TYPES, SO_STATUS } from './sales.types.ts';

export interface DeliveryLineInput {
  readonly soLineId: string;
  readonly qtyDelivered: string;
  readonly batchNo?: string | null;
}

export interface CreateDeliveryInput {
  readonly companyId: string;
  readonly soId: string;
  readonly doDate: string;
  readonly lines: readonly DeliveryLineInput[];
  readonly userId: string;
}

export interface DeliveryResult {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
  readonly cogs: string;
}

interface PreparedLine {
  readonly soLineId: string;
  readonly itemId: string;
  readonly qtyDelivered: string;
  readonly batchNo: string | null;
}

const DELIVERABLE_STATUSES: readonly string[] = [SO_STATUS.CONFIRMED, SO_STATUS.PARTIALLY_DELIVERED];

// Validates each delivery line against the SO remaining qty.
async function prepareLines(tx: Tx, soId: string, lines: readonly DeliveryLineInput[]): Promise<PreparedLine[]> {
  const soLines = await repo.listSoLinesForUpdate(tx, soId);
  const byId = new Map(soLines.map((line) => [line.id, line]));
  const prepared: PreparedLine[] = [];

  for (const line of lines) {
    const soLine = byId.get(line.soLineId);
    if (!soLine) throw new NotFoundError('SO Line', line.soLineId);

    const remaining = toQtyUnits(soLine.qty) - toQtyUnits(soLine.deliveredQty);
    const qty = toQtyUnits(line.qtyDelivered);
    if (qty <= 0n) throw new UnprocessableError('Kuantitas kirim harus lebih dari 0');
    if (qty > remaining) throw new UnprocessableError(`Kuantitas kirim melebihi sisa SO (${fromQtyUnits(remaining)})`);

    prepared.push({ soLineId: line.soLineId, itemId: soLine.itemId, qtyDelivered: line.qtyDelivered, batchNo: line.batchNo ?? null });
  }
  return prepared;
}

// Posts a delivery: releases the soft reserve then stocks out (COGS from costing), atomically (PRD 4.2.2).
export async function createDelivery(input: CreateDeliveryInput): Promise<DeliveryResult> {
  const so = await repo.findSo(input.companyId, input.soId);
  if (!so) throw new NotFoundError('Sales Order', input.soId);
  if (!DELIVERABLE_STATUSES.includes(so.status)) {
    throw new UnprocessableError(`SO berstatus ${so.status} belum dapat dikirim`);
  }

  const period = input.doDate.slice(0, 4);

  return runInTransaction(async (tx) => {
    const prepared = await prepareLines(tx, input.soId, input.lines);
    const id = randomUUID();
    const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'DO', prefix: 'DO', period });

    let cogsCents = 0n;
    const lineRows: (typeof deliveryOrderLines.$inferInsert)[] = [];
    for (const line of prepared) {
      await releaseStockTx(tx, {
        companyId: input.companyId,
        itemId: line.itemId,
        warehouseId: so.warehouseId,
        quantity: line.qtyDelivered,
      });
      const movement = await stockOutTx(tx, {
        companyId: input.companyId,
        itemId: line.itemId,
        warehouseId: so.warehouseId,
        quantity: line.qtyDelivered,
        referenceType: 'DO',
        referenceId: id,
        userId: input.userId,
      });
      cogsCents += toMinorUnits(movement.totalCost);
      lineRows.push({
        id: randomUUID(),
        doId: id,
        soLineId: line.soLineId,
        itemId: line.itemId,
        qtyDelivered: line.qtyDelivered,
        unitCost: movement.unitCost,
        batchNo: line.batchNo,
      });
    }

    await docRepo.insertDo(tx, {
      id,
      companyId: input.companyId,
      docNumber,
      doDate: input.doDate,
      soId: input.soId,
      warehouseId: so.warehouseId,
      status: DO_STATUS.POSTED,
      createdBy: input.userId,
    });
    await docRepo.insertDoLines(tx, lineRows);

    const soStatus = await applyDelivered(tx, input.soId, prepared);

    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.DO_POSTED,
      aggregateType: 'delivery_order',
      aggregateId: id,
      payload: { docNumber, soId: input.soId, cogs: fromMinorUnits(cogsCents) },
    });
    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: 'DO_POSTED',
      entityType: 'delivery_order',
      entityId: id,
      stateAfter: { docNumber, soId: input.soId, soStatus, cogs: fromMinorUnits(cogsCents) },
    });

    return { id, docNumber, status: DO_STATUS.POSTED, cogs: fromMinorUnits(cogsCents) };
  });
}

// Increments delivered_qty on SO lines and flips the SO status (partial vs fully delivered).
async function applyDelivered(tx: Tx, soId: string, prepared: readonly PreparedLine[]): Promise<string> {
  const soLines = await repo.listSoLinesForUpdate(tx, soId);
  const byId = new Map(soLines.map((line) => [line.id, line]));
  for (const line of prepared) {
    const soLine = byId.get(line.soLineId);
    if (!soLine) continue;
    const newDelivered = fromQtyUnits(toQtyUnits(soLine.deliveredQty) + toQtyUnits(line.qtyDelivered));
    await repo.updateSoLine(tx, line.soLineId, { deliveredQty: newDelivered });
    soLine.deliveredQty = newDelivered;
  }

  const fullyDelivered = soLines.every((line) => toQtyUnits(line.deliveredQty) >= toQtyUnits(line.qty));
  const status = fullyDelivered ? SO_STATUS.DELIVERED : SO_STATUS.PARTIALLY_DELIVERED;
  await repo.updateSoStatus(tx, soId, status);
  return status;
}

export function listDeliveries(companyId: string) {
  return docRepo.listDos(companyId);
}
