import { randomUUID } from 'node:crypto';

import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { averageCostCents, consumeFifo, fifoRemainingValueCents, inboundState, movingAverageOutbound, valueOfQty } from './costing.ts';
import type { StockState } from './costing.ts';
import * as repo from './inventory.repository.ts';
import { MOVEMENT_TYPES, OUTBOX_EVENT_TYPES } from './inventory.types.ts';
import type { CostingMethod } from './inventory.types.ts';
import {
  assertTracking,
  currentState,
  ensureStockRow,
  lockFifoLayers,
  serializeState,
} from './stock.helpers.ts';
import type { StockRow } from './stock.helpers.ts';

export interface StockInInput {
  readonly companyId: string;
  readonly itemId: string;
  readonly warehouseId: string;
  readonly quantity: string;
  readonly unitCost: string;
  readonly referenceType?: string | null;
  readonly referenceId?: string | null;
  readonly batchNo?: string | null;
  readonly serialNumbers?: readonly string[];
  readonly userId: string;
}

export interface StockOutInput {
  readonly companyId: string;
  readonly itemId: string;
  readonly warehouseId: string;
  readonly quantity: string;
  readonly referenceType?: string | null;
  readonly referenceId?: string | null;
  readonly serialNumbers?: readonly string[];
  readonly userId: string;
}

export interface MovementResult {
  readonly movementId: string;
  readonly onHand: string;
  readonly unitCost: string;
  readonly totalCost: string;
}

async function requireItem(companyId: string, itemId: string) {
  const item = await repo.findItemById(companyId, itemId);
  if (!item) throw new NotFoundError('Item', itemId);
  return item;
}

// Persists a new on-hand/avg-cost state and appends the ledger row.
async function persistMovement(
  tx: Tx,
  params: {
    readonly companyId: string;
    readonly itemId: string;
    readonly warehouseId: string;
    readonly movementType: string;
    readonly quantityUnits: bigint;
    readonly unitCostCents: bigint;
    readonly totalCostCents: bigint;
    readonly state: StockState;
    readonly referenceType?: string | null;
    readonly referenceId?: string | null;
    readonly batchNo?: string | null;
    readonly userId: string;
  },
): Promise<string> {
  const stock = serializeState(params.state);
  const row = await ensureStockRow(tx, params.companyId, params.itemId, params.warehouseId);
  await repo.updateStock(tx, row.id, { onHand: stock.onHand, avgCost: stock.avgCost });

  const movementId = randomUUID();
  await repo.insertMovement(tx, {
    id: movementId,
    companyId: params.companyId,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    movementType: params.movementType,
    quantity: fromQtyUnits(params.quantityUnits),
    unitCost: fromMinorUnits(params.unitCostCents),
    totalCost: fromMinorUnits(params.totalCostCents),
    balanceQty: stock.onHand,
    balanceValue: fromMinorUnits(params.state.valueCents),
    referenceType: params.referenceType ?? null,
    referenceId: params.referenceId ?? null,
    batchNo: params.batchNo ?? null,
    createdBy: params.userId,
  });
  return movementId;
}

async function insertSerials(
  tx: Tx,
  companyId: string,
  itemId: string,
  warehouseId: string,
  batchNo: string | null | undefined,
  serialNumbers: readonly string[] | undefined,
): Promise<void> {
  if (!serialNumbers || serialNumbers.length === 0) return;
  for (const serialNumber of serialNumbers) {
    await repo.insertSerial(tx, {
      id: randomUUID(),
      companyId,
      itemId,
      warehouseId,
      serialNumber,
      batchNo: batchNo ?? null,
      status: 'IN_STOCK',
    });
  }
}

export async function stockIn(input: StockInInput): Promise<MovementResult> {
  return runInTransaction((tx) => stockInTx(tx, input));
}

// Transactional variant: runs inside the caller's tx so GRN can stay atomic with its journal.
export async function stockInTx(tx: Tx, input: StockInInput): Promise<MovementResult> {
  const item = await requireItem(input.companyId, input.itemId);
  assertTracking(item, { quantity: input.quantity, batchNo: input.batchNo, serialNumbers: input.serialNumbers });

  const method = item.costingMethod as CostingMethod;
  const inQtyUnits = toQtyUnits(input.quantity);
  const inUnitCostCents = toMinorUnits(input.unitCost);

  const row = await ensureStockRow(tx, input.companyId, input.itemId, input.warehouseId);
  const layers = method === 'FIFO' ? await lockFifoLayers(tx, input.itemId, input.warehouseId) : [];

  // Inbound is method-agnostic: value grows by qty * unit cost. FIFO additionally records a layer.
  const state = inboundState(currentState(method, row, layers), inQtyUnits, inUnitCostCents);
  if (method === 'FIFO') {
    await repo.insertCostLayer(tx, {
      id: randomUUID(),
      companyId: input.companyId,
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      quantityRemaining: fromQtyUnits(inQtyUnits),
      unitCost: fromMinorUnits(inUnitCostCents),
    });
  }

  const totalCostCents = valueOfQty(inQtyUnits, inUnitCostCents);
  const movementId = await persistMovement(tx, {
    companyId: input.companyId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    movementType: MOVEMENT_TYPES.STOCK_IN,
    quantityUnits: inQtyUnits,
    unitCostCents: inUnitCostCents,
    totalCostCents,
    state,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    batchNo: input.batchNo,
    userId: input.userId,
  });

  await insertSerials(tx, input.companyId, input.itemId, input.warehouseId, input.batchNo, input.serialNumbers);
  await writeOutboxEvent(tx, {
    eventType: OUTBOX_EVENT_TYPES.STOCK_IN,
    aggregateType: 'item',
    aggregateId: input.itemId,
    payload: { movementId, warehouseId: input.warehouseId, quantity: input.quantity },
  });
  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    action: 'STOCK_IN',
    entityType: 'stock_movement',
    entityId: movementId,
    stateAfter: { itemId: input.itemId, quantity: input.quantity, onHand: serializeState(state).onHand },
  });

  return {
    movementId,
    onHand: serializeState(state).onHand,
    unitCost: fromMinorUnits(inUnitCostCents),
    totalCost: fromMinorUnits(totalCostCents),
  };
}

async function fifoOutbound(
  tx: Tx,
  itemId: string,
  warehouseId: string,
  outQtyUnits: bigint,
): Promise<{ readonly outValueCents: bigint; readonly valueCents: bigint }> {
  const layers = await lockFifoLayers(tx, itemId, warehouseId);
  const totalQty = layers.reduce((sum, layer) => sum + layer.quantityUnits, 0n);
  if (totalQty < outQtyUnits) throw new UnprocessableError('Stok tidak cukup');

  const consumption = consumeFifo(layers, outQtyUnits);
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  for (const entry of consumption.consumed) {
    const layer = byId.get(entry.id);
    if (!layer) continue;
    await repo.setLayerRemaining(tx, entry.id, fromQtyUnits(layer.quantityUnits - entry.quantityUnits));
  }
  return { outValueCents: consumption.totalCostCents, valueCents: fifoRemainingValueCents(layers, consumption.consumed) };
}

export async function stockOut(input: StockOutInput): Promise<MovementResult> {
  return runInTransaction((tx) => stockOutTx(tx, input));
}

// Transactional variant: runs inside the caller's tx so a Delivery Order stays atomic with its journal.
export async function stockOutTx(tx: Tx, input: StockOutInput): Promise<MovementResult> {
  const item = await requireItem(input.companyId, input.itemId);
  if (item.trackSerial) {
    assertTracking(item, { quantity: input.quantity, serialNumbers: input.serialNumbers });
  }

  const method = item.costingMethod as CostingMethod;
  const outQtyUnits = toQtyUnits(input.quantity);

  const row: StockRow = await ensureStockRow(tx, input.companyId, input.itemId, input.warehouseId);
  const available = toQtyUnits(row.onHand) - toQtyUnits(row.reserved);
  if (available < outQtyUnits) throw new UnprocessableError('Stok tidak cukup');

  let outValueCents: bigint;
  let state: StockState;
  if (method === 'FIFO') {
    const result = await fifoOutbound(tx, input.itemId, input.warehouseId, outQtyUnits);
    outValueCents = result.outValueCents;
    const qtyUnits = toQtyUnits(row.onHand) - outQtyUnits;
    state = { qtyUnits, valueCents: result.valueCents, avgCostCents: averageCostCents(result.valueCents, qtyUnits) };
  } else {
    const prev = currentState(method, row, []);
    const result = movingAverageOutbound(prev, outQtyUnits);
    outValueCents = result.outValueCents;
    state = result.state;
  }

  if (item.trackSerial && input.serialNumbers) {
    const serials = await repo.lockSerials(tx, input.companyId, input.itemId, input.serialNumbers);
    const usable = serials.filter((serial) => serial.status === 'IN_STOCK' && serial.warehouseId === input.warehouseId);
    if (usable.length !== input.serialNumbers.length) {
      throw new UnprocessableError('Serial number tidak tersedia di gudang ini');
    }
    await repo.markSerialsIssued(tx, usable.map((serial) => serial.id));
  }

  const unitCostCents = averageCostCents(outValueCents, outQtyUnits);
  const movementId = await persistMovement(tx, {
    companyId: input.companyId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    movementType: MOVEMENT_TYPES.STOCK_OUT,
    quantityUnits: outQtyUnits,
    unitCostCents,
    totalCostCents: outValueCents,
    state,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    userId: input.userId,
  });

  await writeOutboxEvent(tx, {
    eventType: OUTBOX_EVENT_TYPES.STOCK_OUT,
    aggregateType: 'item',
    aggregateId: input.itemId,
    payload: { movementId, warehouseId: input.warehouseId, quantity: input.quantity },
  });
  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    action: 'STOCK_OUT',
    entityType: 'stock_movement',
    entityId: movementId,
    stateAfter: { itemId: input.itemId, quantity: input.quantity, onHand: serializeState(state).onHand },
  });

  return {
    movementId,
    onHand: serializeState(state).onHand,
    unitCost: fromMinorUnits(unitCostCents),
    totalCost: fromMinorUnits(outValueCents),
  };
}

export async function listStock(
  companyId: string,
  filter: { readonly itemId?: string; readonly warehouseId?: string; readonly onlyPositive?: boolean },
) {
  const rows = await repo.listStock(companyId, filter);
  return rows.map((row) => ({
    ...row,
    available: fromQtyUnits(toQtyUnits(row.onHand) - toQtyUnits(row.reserved)),
    value: fromMinorUnits(valueOfQty(toQtyUnits(row.onHand), toMinorUnits(row.avgCost))),
  }));
}

export function listMovements(
  companyId: string,
  filter: { readonly itemId?: string; readonly warehouseId?: string; readonly movementType?: string; readonly limit?: number },
) {
  return repo.listMovements(companyId, filter);
}
