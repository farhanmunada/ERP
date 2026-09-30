import { QTY_SCALE } from '../../core/qty.ts';

// All costing math runs on integer units: qty in 1/10000 units, money in cents.
// Keeping it integer-only avoids float drift across many movements.

export interface CostLayer {
  readonly id: string;
  readonly quantityUnits: bigint;
  readonly unitCostCents: bigint;
}

export interface StockState {
  readonly qtyUnits: bigint;
  readonly valueCents: bigint;
  readonly avgCostCents: bigint;
}

export interface FifoConsumption {
  readonly totalCostCents: bigint;
  readonly consumed: readonly { readonly id: string; readonly quantityUnits: bigint }[];
}

// value (cents) = qty * unitCost
export function valueOfQty(qtyUnits: bigint, unitCostCents: bigint): bigint {
  return (qtyUnits * unitCostCents) / QTY_SCALE;
}

// average cost (cents) = total value / total qty
export function averageCostCents(totalValueCents: bigint, totalQtyUnits: bigint): bigint {
  if (totalQtyUnits === 0n) return 0n;
  return (totalValueCents * QTY_SCALE) / totalQtyUnits;
}

// Inbound is identical for both methods: value grows by qty * unitCost, avg is recomputed.
export function inboundState(prev: StockState, inQtyUnits: bigint, inUnitCostCents: bigint): StockState {
  const qtyUnits = prev.qtyUnits + inQtyUnits;
  const valueCents = prev.valueCents + valueOfQty(inQtyUnits, inUnitCostCents);
  return { qtyUnits, valueCents, avgCostCents: averageCostCents(valueCents, qtyUnits) };
}

// Moving average: outbound consumes at the current average cost.
export function movingAverageOutbound(
  prev: StockState,
  outQtyUnits: bigint,
): { readonly outValueCents: bigint; readonly state: StockState } {
  const outValueCents = valueOfQty(outQtyUnits, prev.avgCostCents);
  const qtyUnits = prev.qtyUnits - outQtyUnits;
  const valueCents = prev.valueCents - outValueCents;
  return {
    outValueCents,
    state: { qtyUnits, valueCents, avgCostCents: qtyUnits > 0n ? prev.avgCostCents : 0n },
  };
}

// FIFO: consume oldest layers first. Throws when layers cannot cover the requested qty.
export function consumeFifo(layers: readonly CostLayer[], outQtyUnits: bigint): FifoConsumption {
  let remaining = outQtyUnits;
  let totalCostCents = 0n;
  const consumed: { id: string; quantityUnits: bigint }[] = [];

  for (const layer of layers) {
    if (remaining <= 0n) break;
    const take = layer.quantityUnits < remaining ? layer.quantityUnits : remaining;
    totalCostCents += valueOfQty(take, layer.unitCostCents);
    consumed.push({ id: layer.id, quantityUnits: take });
    remaining -= take;
  }

  if (remaining > 0n) throw new Error('Layer FIFO tidak cukup untuk memenuhi kuantitas keluar');
  return { totalCostCents, consumed };
}

// Remaining value of a FIFO layer set after a consumption.
export function fifoRemainingValueCents(
  layers: readonly CostLayer[],
  consumed: FifoConsumption['consumed'],
): bigint {
  const takenByLayer = new Map(consumed.map((entry) => [entry.id, entry.quantityUnits]));
  let valueCents = 0n;
  for (const layer of layers) {
    const taken = takenByLayer.get(layer.id) ?? 0n;
    valueCents += valueOfQty(layer.quantityUnits - taken, layer.unitCostCents);
  }
  return valueCents;
}
