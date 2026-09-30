import { describe, expect, test } from 'bun:test';

import { fromMinorUnits, sumMinorUnits, toMinorUnits } from './money.ts';

describe('toMinorUnits', () => {
  test('mengonversi string desimal ke minor units', () => {
    expect(toMinorUnits('15000.00')).toBe(1_500_000n);
    expect(toMinorUnits('0.01')).toBe(1n);
    expect(toMinorUnits('10')).toBe(1_000n);
  });

  test('menangani nilai negatif', () => {
    expect(toMinorUnits('-12.50')).toBe(-1_250n);
  });

  test('menolak format tidak valid', () => {
    expect(() => toMinorUnits('abc')).toThrow('tidak valid');
  });
});

describe('fromMinorUnits', () => {
  test('mengembalikan format desimal 2 digit', () => {
    expect(fromMinorUnits(1_500_000n)).toBe('15000.00');
    expect(fromMinorUnits(1n)).toBe('0.01');
    expect(fromMinorUnits(-1_250n)).toBe('-12.50');
  });
});

describe('sumMinorUnits', () => {
  test('menjumlahkan tanpa kehilangan presisi float', () => {
    // 0.1 + 0.2 !== 0.3 dalam float; harus tepat dalam minor units.
    expect(sumMinorUnits(['0.10', '0.20'])).toBe(30n);
    expect(fromMinorUnits(sumMinorUnits(['0.10', '0.20']))).toBe('0.30');
  });
});
