import { randomUUID } from 'node:crypto';

import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { UnprocessableError } from '../../core/errors/app-error.ts';
import { averageCostCents, valueOfQty } from './costing.ts';
import type { CostLayer, StockState } from './costing.ts';
import * as repo from './inventory.repository.ts';
import type { CostingMethod } from './inventory.types.ts';

export interface StockRow {
  readonly id: string;
  readonly onHand: string;
  readonly reserved: string;
  readonly avgCost: string;
}

// Locks the (item, warehouse) balance row, creating it first when absent so the lock always exists.
export async function ensureStockRow(
  tx: Tx,
  companyId: string,
  itemId: string,
  warehouseId: string,
): Promise<StockRow> {
  let row = await repo.lockStock(tx, itemId, warehouseId);
  if (!row) {
    await repo.insertStock(tx, {
      id: randomUUID(),
      companyId,
      itemId,
      warehouseId,
      onHand: '0.0000',
      reserved: '0.0000',
      avgCost: '0.00',
    });
    row = await repo.lockStock(tx, itemId, warehouseId);
  }
  if (!row) throw new Error('Gagal mengunci baris stok');
  return { id: row.id, onHand: row.onHand, reserved: row.reserved, avgCost: row.avgCost };
}

// Locks (item, warehouse) rows in ascending warehouse id order to keep a global lock order.
export async function lockStockRowsOrdered(
  tx: Tx,
  companyId: string,
  itemId: string,
  warehouseIds: readonly string[],
): Promise<Map<string, StockRow>> {
  const ordered = [...new Set(warehouseIds)].sort();
  const result = new Map<string, StockRow>();
  for (const warehouseId of ordered) {
    result.set(warehouseId, await ensureStockRow(tx, companyId, itemId, warehouseId));
  }
  return result;
}

export function lockFifoLayers(tx: Tx, itemId: string, warehouseId: string): Promise<CostLayer[]> {
  return repo.lockCostLayers(tx, itemId, warehouseId).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      quantityUnits: toQtyUnits(row.quantityRemaining),
      unitCostCents: toMinorUnits(row.unitCost),
    })),
  );
}

export function layersValueCents(layers: readonly CostLayer[]): bigint {
  return layers.reduce((total, layer) => total + valueOfQty(layer.quantityUnits, layer.unitCostCents), 0n);
}

// Current stock state. For FIFO the value comes from the cost layers, not the rounded avg cost.
export function currentState(
  method: CostingMethod,
  row: StockRow,
  layers: readonly CostLayer[],
): StockState {
  const qtyUnits = toQtyUnits(row.onHand);
  if (method === 'FIFO') {
    const valueCents = layersValueCents(layers);
    return { qtyUnits, valueCents, avgCostCents: averageCostCents(valueCents, qtyUnits) };
  }
  const avgCostCents = toMinorUnits(row.avgCost);
  return { qtyUnits, valueCents: valueOfQty(qtyUnits, avgCostCents), avgCostCents };
}

export function availableUnits(row: StockRow): bigint {
  return toQtyUnits(row.onHand) - toQtyUnits(row.reserved);
}

export function serializeState(state: StockState): { readonly onHand: string; readonly avgCost: string } {
  return { onHand: fromQtyUnits(state.qtyUnits), avgCost: fromMinorUnits(state.avgCostCents) };
}

export interface TrackingInput {
  readonly quantity: string;
  readonly batchNo?: string | null;
  readonly serialNumbers?: readonly string[];
}

// Enforces batch/serial requirements configured on the item (PRD Story 2.5).
export function assertTracking(
  item: { readonly trackBatch: boolean; readonly trackSerial: boolean; readonly name: string },
  input: TrackingInput,
): void {
  if (item.trackBatch && !input.batchNo) {
    throw new UnprocessableError('Nomor batch wajib untuk item ini');
  }
  if (item.trackSerial) {
    const serials = input.serialNumbers ?? [];
    if (serials.length !== Number(input.quantity)) {
      throw new UnprocessableError('Jumlah serial number harus sama dengan kuantitas');
    }
    if (new Set(serials).size !== serials.length) {
      throw new UnprocessableError('Serial number tidak boleh duplikat');
    }
  }
}
