import { toMinorUnits } from '../../core/money.ts';
import { APPROVAL_STATUS } from './approval.types.ts';
import type { ApprovalRuleDefinition, ApprovalStatus } from './approval.types.ts';

// Pure: pick the first active rule whose [minAmount, maxAmount] range covers the amount.
export function selectRule(
  rules: readonly ApprovalRuleDefinition[],
  amount: string,
): ApprovalRuleDefinition | null {
  const value = toMinorUnits(amount);
  return (
    rules.find((rule) => {
      const min = toMinorUnits(rule.minAmount);
      const max = rule.maxAmount === null ? null : toMinorUnits(rule.maxAmount);
      return value >= min && (max === null || value <= max);
    }) ?? null
  );
}

export interface ApprovalTransition {
  readonly nextLevel: number;
  readonly status: ApprovalStatus;
}

// Pure: compute the next approval state after an APPROVE/REJECT action at a level.
export function advanceApproval(
  action: 'APPROVE' | 'REJECT',
  currentLevel: number,
  totalLevels: number,
): ApprovalTransition {
  if (action === 'REJECT') {
    return { nextLevel: currentLevel, status: APPROVAL_STATUS.REJECTED };
  }
  if (currentLevel >= totalLevels) {
    return { nextLevel: currentLevel, status: APPROVAL_STATUS.APPROVED };
  }
  return { nextLevel: currentLevel + 1, status: APPROVAL_STATUS.PENDING };
}
