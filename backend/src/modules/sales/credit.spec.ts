import { describe, expect, test } from 'bun:test';

import { checkCredit } from './credit.ts';
import { computeAmounts, lineAmountCents } from './amounts.ts';

describe('checkCredit (PRD Story 4.1.2)', () => {
  test('4.1.2 limit 5.000.000, outstanding 4.500.000, order 1.000.000 → ditolak', () => {
    const result = checkCredit({ creditLimit: '5000000.00', outstanding: '4500000.00', orderTotal: '1000000.00' });
    expect(result.allowed).toBe(false);
    expect(result.available).toBe('500000.00');
    expect(result.projected).toBe('5500000.00');
  });

  test('4.1.3 limit 5.000.000, outstanding 4.500.000, order 400.000 → lolos', () => {
    const result = checkCredit({ creditLimit: '5000000.00', outstanding: '4500000.00', orderTotal: '400000.00' });
    expect(result.allowed).toBe(true);
    expect(result.available).toBe('500000.00');
  });

  test('outstanding melebihi limit → available 0', () => {
    const result = checkCredit({ creditLimit: '1000000.00', outstanding: '1200000.00', orderTotal: '0.00' });
    expect(result.allowed).toBe(false);
    expect(result.available).toBe('0.00');
  });

  test('tepat sama dengan limit → lolos', () => {
    const result = checkCredit({ creditLimit: '5000000.00', outstanding: '4000000.00', orderTotal: '1000000.00' });
    expect(result.allowed).toBe(true);
  });
});

describe('sales amounts', () => {
  test('line amount = qty * unit price', () => {
    expect(lineAmountCents('200', '15000')).toBe(300_000_000n);
  });

  test('computeAmounts subtotal + tax = total', () => {
    const amounts = computeAmounts([{ qty: '200', unitPrice: '15000' }], '330000.00');
    expect(amounts.subtotal).toBe('3000000.00');
    expect(amounts.tax).toBe('330000.00');
    expect(amounts.total).toBe('3330000.00');
  });
});
