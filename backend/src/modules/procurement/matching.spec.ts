import { describe, expect, test } from 'bun:test';

import { matchThreeWay } from './matching.ts';
import { computeAmounts, lineAmountCents } from './amounts.ts';

const tolerance = { qtyPct: '2.00', pricePct: '2.00' };

describe('matchThreeWay (PRD Story 3.3)', () => {
  test('3.3.1 PO 100@10.000, GRN 100, Bill 100@10.000 → PASS', () => {
    const result = matchThreeWay(
      [{ poLineId: 'l1', itemId: 'i1', qtyPo: '100', qtyGrn: '100', qtyBill: '100', pricePo: '10000', priceBill: '10000' }],
      tolerance,
    );
    expect(result.status).toBe('PASS');
    expect(result.lines[0]?.status).toBe('OK');
    expect(result.lines[0]?.priceDiffPct).toBe('0.00');
  });

  test('3.3.2 PO 100@10.000, GRN 100, Bill 100@10.500 (5% > 2%) → EXCEPTION', () => {
    const result = matchThreeWay(
      [{ poLineId: 'l1', itemId: 'i1', qtyPo: '100', qtyGrn: '100', qtyBill: '100', pricePo: '10000', priceBill: '10500' }],
      tolerance,
    );
    expect(result.status).toBe('EXCEPTION');
    expect(result.lines[0]?.priceDiffPct).toBe('5.00');
    expect(result.lines[0]?.status).toBe('EXCEPTION');
  });

  test('qty diff within tolerance passes', () => {
    const result = matchThreeWay(
      [{ poLineId: 'l1', itemId: 'i1', qtyPo: '100', qtyGrn: '100', qtyBill: '101', pricePo: '10000', priceBill: '10000' }],
      tolerance,
    );
    expect(result.lines[0]?.qtyDiffPct).toBe('1.00');
    expect(result.status).toBe('PASS');
  });

  test('qty diff beyond tolerance is an exception', () => {
    const result = matchThreeWay(
      [{ poLineId: 'l1', itemId: 'i1', qtyPo: '100', qtyGrn: '100', qtyBill: '103', pricePo: '10000', priceBill: '10000' }],
      tolerance,
    );
    expect(result.lines[0]?.qtyDiffPct).toBe('3.00');
    expect(result.status).toBe('EXCEPTION');
  });
});

describe('amounts', () => {
  test('line amount = qty * unit price', () => {
    expect(lineAmountCents('100', '10000')).toBe(100_000_000n);
    expect(lineAmountCents('2', '10500')).toBe(2_100_000n);
  });

  test('computeAmounts subtotal + tax = total', () => {
    const amounts = computeAmounts([{ qty: '100', unitPrice: '10000' }], '110000.00');
    expect(amounts.subtotal).toBe('1000000.00');
    expect(amounts.tax).toBe('110000.00');
    expect(amounts.total).toBe('1110000.00');
  });
});
