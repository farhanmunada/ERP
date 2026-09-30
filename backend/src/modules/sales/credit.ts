import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';

export interface CreditCheckInput {
  readonly creditLimit: string;
  readonly outstanding: string;
  readonly orderTotal: string;
}

export interface CreditCheckResult {
  readonly limit: string;
  readonly outstanding: string;
  readonly available: string;
  readonly projected: string;
  readonly allowed: boolean;
}

// Pure credit check (PRD Story 4.1.2): allow when outstanding + order total does not exceed the limit.
export function checkCredit(input: CreditCheckInput): CreditCheckResult {
  const limitCents = toMinorUnits(input.creditLimit);
  const outstandingCents = toMinorUnits(input.outstanding);
  const totalCents = toMinorUnits(input.orderTotal);
  const projectedCents = outstandingCents + totalCents;

  return {
    limit: fromMinorUnits(limitCents),
    outstanding: fromMinorUnits(outstandingCents),
    available: fromMinorUnits(limitCents > outstandingCents ? limitCents - outstandingCents : 0n),
    projected: fromMinorUnits(projectedCents),
    allowed: projectedCents <= limitCents,
  };
}
