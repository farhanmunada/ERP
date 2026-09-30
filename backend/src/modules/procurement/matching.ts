import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import { MATCH_LINE_STATUS } from './procurement.types.ts';
import type { MatchLine, MatchLineStatus, MatchResult } from './procurement.types.ts';

export interface MatchTolerance {
  readonly qtyPct: string;
  readonly pricePct: string;
}

export interface MatchInputLine {
  readonly poLineId: string;
  readonly itemId: string;
  readonly qtyPo: string;
  readonly qtyGrn: string;
  readonly qtyBill: string;
  readonly pricePo: string;
  readonly priceBill: string;
}

// Percent difference in basis points (1% = 100 bp) computed with integer units to stay exact.
// Returns 0 when the reference value is zero (no meaningful comparison base).
function diffBasisPoints(actual: string, reference: string): bigint {
  const ref = toMinorUnits(reference);
  if (ref === 0n) return 0n;
  const act = toMinorUnits(actual);
  const delta = act - ref;
  const abs = delta < 0n ? -delta : delta;
  return (abs * 10_000n) / ref;
}

// Same idea for quantities (scale 1/10000 instead of 1/100).
function qtyDiffBasisPoints(actual: string, reference: string): bigint {
  const ref = toQtyUnits(reference);
  if (ref === 0n) return 0n;
  const act = toQtyUnits(actual);
  const delta = act - ref;
  const abs = delta < 0n ? -delta : delta;
  return (abs * 10_000n) / ref;
}

function pctFromBasisPoints(bp: bigint): string {
  return fromMinorUnits(bp);
}

function withinTolerance(bp: bigint, tolerancePct: string): boolean {
  return bp <= toMinorUnits(tolerancePct);
}

// Pure 3-way matching: compares PO vs GRN vs Bill per line (PRD Story 3.3).
export function matchThreeWay(lines: readonly MatchInputLine[], tolerance: MatchTolerance): MatchResult {
  const matched: MatchLine[] = lines.map((line) => {
    const qtyBp = qtyDiffBasisPoints(line.qtyBill, line.qtyGrn);
    const priceBp = diffBasisPoints(line.priceBill, line.pricePo);
    const status: MatchLineStatus =
      withinTolerance(qtyBp, tolerance.qtyPct) && withinTolerance(priceBp, tolerance.pricePct)
        ? MATCH_LINE_STATUS.OK
        : MATCH_LINE_STATUS.EXCEPTION;
    return {
      itemId: line.itemId,
      poLineId: line.poLineId,
      qtyPo: line.qtyPo,
      qtyGrn: line.qtyGrn,
      qtyBill: line.qtyBill,
      pricePo: line.pricePo,
      priceBill: line.priceBill,
      qtyDiffPct: pctFromBasisPoints(qtyBp),
      priceDiffPct: pctFromBasisPoints(priceBp),
      status,
    };
  });

  const hasException = matched.some((line) => line.status === MATCH_LINE_STATUS.EXCEPTION);
  return {
    status: hasException ? 'EXCEPTION' : 'PASS',
    tolerance: { qtyPct: tolerance.qtyPct, pricePct: tolerance.pricePct },
    lines: matched,
  };
}
