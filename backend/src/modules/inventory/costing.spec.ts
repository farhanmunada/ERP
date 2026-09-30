import { describe, expect, test } from 'bun:test';

import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import {
  averageCostCents,
  consumeFifo,
  fifoRemainingValueCents,
  inboundState,
  movingAverageOutbound,
  valueOfQty,
} from './costing.ts';

describe('Moving Average', () => {
  test('PRD 2.3.1: 100 @ 10.000 + 100 @ 12.000 → rata-rata 11.000', () => {
    const start = inboundState({ qtyUnits: 0n, valueCents: 0n, avgCostCents: 0n }, toQtyUnits('100'), toMinorUnits('10000.00'));
    const after = inboundState(start, toQtyUnits('100'), toMinorUnits('12000.00'));

    expect(fromQtyUnits(after.qtyUnits)).toBe('200.0000');
    expect(fromMinorUnits(after.valueCents)).toBe('2200000.00');
    expect(fromMinorUnits(after.avgCostCents)).toBe('11000.00');
  });

  test('outbound memakai average cost berjalan dan menyisakan nilai proporsional', () => {
    const state = { qtyUnits: toQtyUnits('200'), valueCents: toMinorUnits('2200000.00'), avgCostCents: toMinorUnits('11000.00') };
    const { outValueCents, state: after } = movingAverageOutbound(state, toQtyUnits('50'));

    expect(fromMinorUnits(outValueCents)).toBe('550000.00');
    expect(fromQtyUnits(after.qtyUnits)).toBe('150.0000');
    expect(fromMinorUnits(after.avgCostCents)).toBe('11000.00');
  });

  test('outbound sampai nol mereset average cost', () => {
    const state = { qtyUnits: toQtyUnits('10'), valueCents: toMinorUnits('100000.00'), avgCostCents: toMinorUnits('10000.00') };
    const { state: after } = movingAverageOutbound(state, toQtyUnits('10'));

    expect(after.qtyUnits).toBe(0n);
    expect(after.avgCostCents).toBe(0n);
  });
});

describe('FIFO', () => {
  test('PRD 2.3.2: keluar 150 dari layer 100@10.000 + 100@12.000 → HPP 1.600.000', () => {
    const layers = [
      { id: 'l1', quantityUnits: toQtyUnits('100'), unitCostCents: toMinorUnits('10000.00') },
      { id: 'l2', quantityUnits: toQtyUnits('100'), unitCostCents: toMinorUnits('12000.00') },
    ];
    const result = consumeFifo(layers, toQtyUnits('150'));

    expect(fromMinorUnits(result.totalCostCents)).toBe('1600000.00');
    expect(result.consumed).toHaveLength(2);
    expect(fromQtyUnits(result.consumed[0]!.quantityUnits)).toBe('100.0000');
    expect(fromQtyUnits(result.consumed[1]!.quantityUnits)).toBe('50.0000');
    expect(fromMinorUnits(fifoRemainingValueCents(layers, result.consumed))).toBe('600000.00');
  });

  test('melempar error bila layer tidak cukup', () => {
    const layers = [{ id: 'l1', quantityUnits: toQtyUnits('10'), unitCostCents: toMinorUnits('1000.00') }];
    expect(() => consumeFifo(layers, toQtyUnits('11'))).toThrow();
  });
});

describe('helpers', () => {
  test('valueOfQty dan averageCostCents konsisten', () => {
    expect(fromMinorUnits(valueOfQty(toQtyUnits('3'), toMinorUnits('2500.00')))).toBe('7500.00');
    expect(fromMinorUnits(averageCostCents(toMinorUnits('7500.00'), toQtyUnits('3')))).toBe('2500.00');
  });

  test('averageCostCents nol saat qty nol', () => {
    expect(averageCostCents(toMinorUnits('100.00'), 0n)).toBe(0n);
  });
});
