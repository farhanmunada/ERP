import { describe, expect, test } from 'bun:test';

import { advanceApproval, selectRule } from './approval.logic.ts';
import { APPROVAL_STATUS } from './approval.types.ts';
import type { ApprovalRuleDefinition } from './approval.types.ts';

const RULES: ApprovalRuleDefinition[] = [
  { id: 'r1', minAmount: '0.00', maxAmount: '100000000.00', levels: [{ level: 1, roleCode: 'MANAGER' }] },
  {
    id: 'r2',
    minAmount: '100000000.01',
    maxAmount: null,
    levels: [
      { level: 1, roleCode: 'MANAGER' },
      { level: 2, roleCode: 'DIRECTOR' },
    ],
  },
];

describe('selectRule', () => {
  test('memilih rule tier-1 untuk nominal kecil', () => {
    expect(selectRule(RULES, '50000000.00')?.id).toBe('r1');
  });

  test('memilih rule 2-tier untuk nominal di atas 100 juta', () => {
    expect(selectRule(RULES, '150000000.00')?.id).toBe('r2');
  });

  test('mengembalikan null bila tidak ada rule yang cocok', () => {
    const onlyTier1: ApprovalRuleDefinition[] = [
      { id: 'r1', minAmount: '0.00', maxAmount: '1000000.00', levels: [{ level: 1, roleCode: 'M' }] },
    ];
    expect(selectRule(onlyTier1, '999999999.00')).toBeNull();
  });
});

describe('advanceApproval', () => {
  test('naik level saat masih ada level berikutnya', () => {
    expect(advanceApproval('APPROVE', 1, 2)).toEqual({ nextLevel: 2, status: APPROVAL_STATUS.PENDING });
  });

  test('APPROVED saat level terakhir disetujui', () => {
    expect(advanceApproval('APPROVE', 2, 2)).toEqual({ nextLevel: 2, status: APPROVAL_STATUS.APPROVED });
  });

  test('REJECTED saat ditolak', () => {
    expect(advanceApproval('REJECT', 1, 2)).toEqual({ nextLevel: 1, status: APPROVAL_STATUS.REJECTED });
  });
});
