import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import { UnprocessableError } from '../../core/errors/app-error.ts';
import type { Tx } from '../../core/database/transaction.ts';
import * as repo from './inventory.repository.ts';
import { ensureStockRow } from './stock.helpers.ts';

export interface ReserveInput {
  readonly companyId: string;
  readonly itemId: string;
  readonly warehouseId: string;
  readonly quantity: string;
}

// Holds qty as reserved without touching on_hand (PRD Story 4.2.1).
// The reserved bucket reduces availability so concurrent orders cannot oversell.
export async function reserveStockTx(tx: Tx, input: ReserveInput): Promise<void> {
  const qtyUnits = toQtyUnits(input.quantity);
  if (qtyUnits <= 0n) throw new UnprocessableError('Kuantitas reserve harus lebih dari 0');

  const row = await ensureStockRow(tx, input.companyId, input.itemId, input.warehouseId);
  const available = toQtyUnits(row.onHand) - toQtyUnits(row.reserved);
  if (available < qtyUnits) throw new UnprocessableError('Stok tidak cukup');

  await repo.updateStock(tx, row.id, { reserved: fromQtyUnits(toQtyUnits(row.reserved) + qtyUnits) });
}

// Releases previously reserved qty (SO cancel or delivery fulfilment).
export async function releaseStockTx(tx: Tx, input: ReserveInput): Promise<void> {
  const qtyUnits = toQtyUnits(input.quantity);
  if (qtyUnits <= 0n) return;

  const row = await ensureStockRow(tx, input.companyId, input.itemId, input.warehouseId);
  const next = toQtyUnits(row.reserved) - qtyUnits;
  await repo.updateStock(tx, row.id, { reserved: fromQtyUnits(next > 0n ? next : 0n) });
}
