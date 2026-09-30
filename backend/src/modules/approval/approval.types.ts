export const APPROVAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ApprovalStatus = (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS];

export interface ApprovalLevel {
  readonly level: number;
  readonly roleCode: string;
}

export interface ApprovalRuleDefinition {
  readonly id: string;
  readonly minAmount: string;
  readonly maxAmount: string | null;
  readonly levels: readonly ApprovalLevel[];
}

export interface ApprovalHistoryEntry {
  readonly level: number;
  readonly action: 'SUBMIT' | 'APPROVE' | 'REJECT';
  readonly userId: string;
  readonly at: string;
  readonly note?: string;
}
