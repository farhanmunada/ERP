import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import { QTY_SCALE, toQtyUnits } from '../../core/qty.ts';

// line amount (cents) = qty * unitPrice, computed in integer units to avoid float drift.
export function lineAmountCents(qty: string, unitPrice: string): bigint {
  return (toQtyUnits(qty) * toMinorUnits(unitPrice)) / QTY_SCALE;
}

export interface AmountLine {
  readonly qty: string;
  readonly unitPrice: string;
}

export interface DocumentAmounts {
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
}

// Computes subtotal from lines, then total = subtotal + tax.
export function computeAmounts(lines: readonly AmountLine[], tax: string): DocumentAmounts {
  const subtotalCents = lines.reduce((total, line) => total + lineAmountCents(line.qty, line.unitPrice), 0n);
  const taxCents = toMinorUnits(tax);
  return {
    subtotal: fromMinorUnits(subtotalCents),
    tax: fromMinorUnits(taxCents),
    total: fromMinorUnits(subtotalCents + taxCents),
  };
}
