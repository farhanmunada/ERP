import { randomUUID } from 'node:crypto';

import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { averageCostCents, consumeFifo, fifoRemainingValueCents, inboundState, movingAverageOutbound, valueOfQty } from './costing.ts';
import type { StockState } from './costing.ts';
import * as repo from './inventory.repository.ts';
import { MOVEMENT_TYPES, OUTBOX_EVENT_TYPES, TRANSFER_STATUS } from './inventory.types.ts';
import type { CostingMethod } from './inventory.types.ts';
import { currentState, ensureStockRow, lockFifoLayers, serializeState } from './stock.helpers.ts';

export interface CreateTransferInput {
  readonly companyId: string;
  readonly itemId: string;
  readonly fromWarehouseId: string;
  readonly toWarehouseId: string;
  readonly quantity: string;
  readonly userId: string;
}

export interface TransferResult {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
}

// Creates an in-transit transfer: the quantity is held as reserved at the source warehouse (PRD 2.2.2).
export async function createTransfer(input: CreateTransferInput): Promise<TransferResult> {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new UnprocessableError('Gudang asal dan tujuan tidak boleh sama');
  }
  const item = await repo.findItemById(input.companyId, input.itemId);
  if (!item) throw new NotFoundError('Item', input.itemId);

  const qtyUnits = toQtyUnits(input.quantity);
  const period = new Date().toISOString().slice(0, 4);

  return runInTransaction(async (tx) => {
    const source = await ensureStockRow(tx, input.companyId, input.itemId, input.fromWarehouseId);
    const available = toQtyUnits(source.onHand) - toQtyUnits(source.reserved);
    if (available < qtyUnits) throw new UnprocessableError('Stok tidak cukup');

    const id = randomUUID();
    const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'TRF', prefix: 'TRF', period });
    await repo.updateStock(tx, source.id, { reserved: fromQtyUnits(toQtyUnits(source.reserved) + qtyUnits) });
    await repo.insertTransfer(tx, {
      id,
      companyId: input.companyId,
      docNumber,
      itemId: input.itemId,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      quantity: input.quantity,
      status: TRANSFER_STATUS.IN_TRANSIT,
      createdBy: input.userId,
    });

    return { id, docNumber, status: TRANSFER_STATUS.IN_TRANSIT };
  });
}

async function consumeSource(
  tx: Tx,
  method: CostingMethod,
  companyId: string,
  itemId: string,
  warehouseId: string,
  qtyUnits: bigint,
): Promise<{ readonly outValueCents: bigint; readonly sourceState: StockState; readonly sourceRow: { id: string; onHand: string; reserved: string; avgCost: string } }> {
  const row = await ensureStockRow(tx, companyId, itemId, warehouseId);
  if (method === 'FIFO') {
    const layers = await lockFifoLayers(tx, itemId, warehouseId);
    const consumption = consumeFifo(layers, qtyUnits);
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    for (const entry of consumption.consumed) {
      const layer = byId.get(entry.id);
      if (layer) await repo.setLayerRemaining(tx, entry.id, fromQtyUnits(layer.quantityUnits - entry.quantityUnits));
    }
    const qty = toQtyUnits(row.onHand) - qtyUnits;
    const valueCents = fifoRemainingValueCents(layers, consumption.consumed);
    return {
      outValueCents: consumption.totalCostCents,
      sourceState: { qtyUnits: qty, valueCents, avgCostCents: averageCostCents(valueCents, qty) },
      sourceRow: row,
    };
  }
  const result = movingAverageOutbound(currentState(method, row, []), qtyUnits);
  return { outValueCents: result.outValueCents, sourceState: result.state, sourceRow: row };
}

// Completes a transfer: one OUT at source and one IN at destination, in a single transaction (PRD 2.2.1).
export async function completeTransfer(companyId: string, transferId: string, userId: string): Promise<TransferResult> {
  const transfer = await getTransferOrThrow(companyId, transferId);
  const item = await repo.findItemById(companyId, transfer.itemId);
  if (!item) throw new NotFoundError('Item', transfer.itemId);
  const method = item.costingMethod as CostingMethod;
  const qtyUnits = toQtyUnits(transfer.quantity);

  return runInTransaction(async (tx) => {
    const locked = await repo.findTransferForUpdate(tx, companyId, transferId);
    if (!locked) throw new NotFoundError('Transfer', transferId);
    if (locked.status === TRANSFER_STATUS.COMPLETED) {
      throw new UnprocessableError('Transfer sudah diselesaikan');
    }

    const { outValueCents, sourceState, sourceRow } = await consumeSource(
      tx,
      method,
      companyId,
      transfer.itemId,
      transfer.fromWarehouseId,
      qtyUnits,
    );

    // Release the in-transit reservation and remove the goods from the source warehouse.
    await repo.updateStock(tx, sourceRow.id, {
      onHand: serializeState(sourceState).onHand,
      reserved: fromQtyUnits(toQtyUnits(sourceRow.reserved) - qtyUnits),
      avgCost: serializeState(sourceState).avgCost,
    });
    await repo.insertMovement(tx, {
      id: randomUUID(),
      companyId,
      itemId: transfer.itemId,
      warehouseId: transfer.fromWarehouseId,
      movementType: MOVEMENT_TYPES.TRANSFER_OUT,
      quantity: transfer.quantity,
      unitCost: fromMinorUnits(averageCostCents(outValueCents, qtyUnits)),
      totalCost: fromMinorUnits(outValueCents),
      balanceQty: serializeState(sourceState).onHand,
      balanceValue: fromMinorUnits(sourceState.valueCents),
      referenceType: 'TRANSFER',
      referenceId: transferId,
      createdBy: userId,
    });

    // Inbound at destination at the same cost carried by the transfer.
    const destRow = await ensureStockRow(tx, companyId, transfer.itemId, transfer.toWarehouseId);
    const unitCostCents = averageCostCents(outValueCents, qtyUnits);
    const destState = inboundState(currentState(method, destRow, []), qtyUnits, unitCostCents);
    if (method === 'FIFO') {
      await repo.insertCostLayer(tx, {
        id: randomUUID(),
        companyId,
        itemId: transfer.itemId,
        warehouseId: transfer.toWarehouseId,
        quantityRemaining: transfer.quantity,
        unitCost: fromMinorUnits(unitCostCents),
      });
    }
    await repo.updateStock(tx, destRow.id, {
      onHand: serializeState(destState).onHand,
      avgCost: serializeState(destState).avgCost,
    });
    await repo.insertMovement(tx, {
      id: randomUUID(),
      companyId,
      itemId: transfer.itemId,
      warehouseId: transfer.toWarehouseId,
      movementType: MOVEMENT_TYPES.TRANSFER_IN,
      quantity: transfer.quantity,
      unitCost: fromMinorUnits(unitCostCents),
      totalCost: fromMinorUnits(valueOfQty(qtyUnits, unitCostCents)),
      balanceQty: serializeState(destState).onHand,
      balanceValue: fromMinorUnits(destState.valueCents),
      referenceType: 'TRANSFER',
      referenceId: transferId,
      createdBy: userId,
    });

    await repo.completeTransferRow(tx, transferId, new Date().toISOString());
    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.TRANSFER_COMPLETED,
      aggregateType: 'stock_transfer',
      aggregateId: transferId,
      payload: { itemId: transfer.itemId, quantity: transfer.quantity, from: transfer.fromWarehouseId, to: transfer.toWarehouseId },
    });
    await writeAuditLog(tx, {
      companyId,
      userId,
      action: 'TRANSFER_COMPLETE',
      entityType: 'stock_transfer',
      entityId: transferId,
      stateAfter: { status: TRANSFER_STATUS.COMPLETED },
    });

    return { id: transferId, docNumber: transfer.docNumber, status: TRANSFER_STATUS.COMPLETED };
  });
}

async function getTransferOrThrow(companyId: string, transferId: string) {
  const transfer = await repo.findTransfer(companyId, transferId);
  if (!transfer) throw new NotFoundError('Transfer', transferId);
  return transfer;
}

export function listTransfers(companyId: string, status?: string) {
  return repo.listTransfers(companyId, status);
}
