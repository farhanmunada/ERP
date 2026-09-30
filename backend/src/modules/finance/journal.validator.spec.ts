import { describe, expect, test } from 'bun:test';

import { buildReversalLines, validateJournalBalance } from './journal.validator.ts';

const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';

describe('validateJournalBalance', () => {
  test('menolak jurnal yang tidak balance', () => {
    expect(() =>
      validateJournalBalance([
        { accountId: A, debit: '1000000.00', credit: '0.00' },
        { accountId: B, debit: '0.00', credit: '900000.00' },
      ]),
    ).toThrow('tidak balance');
  });

  test('menerima jurnal yang balance', () => {
    expect(() =>
      validateJournalBalance([
        { accountId: A, debit: '1000000.00', credit: '0.00' },
        { accountId: B, debit: '0.00', credit: '1000000.00' },
      ]),
    ).not.toThrow();
  });

  test('menolak jurnal bernilai nol', () => {
    expect(() =>
      validateJournalBalance([
        { accountId: A, debit: '0.00', credit: '0.00' },
        { accountId: B, debit: '0.00', credit: '0.00' },
      ]),
    ).toThrow('tidak boleh bernilai nol');
  });
});

describe('buildReversalLines', () => {
  test('menukar debit dan kredit', () => {
    const reversed = buildReversalLines([
      { accountId: A, debit: '1000.00', credit: '0.00' },
      { accountId: B, debit: '0.00', credit: '1000.00' },
    ]);

    expect(reversed[0]).toMatchObject({ debit: '0.00', credit: '1000.00' });
    expect(reversed[1]).toMatchObject({ debit: '1000.00', credit: '0.00' });
  });
});
