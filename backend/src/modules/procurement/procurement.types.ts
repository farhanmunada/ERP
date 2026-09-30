export const PR_STATUS = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  CONVERTED: 'CONVERTED',
} as const;
export type PrStatus = (typeof PR_STATUS)[keyof typeof PR_STATUS];

export const PO_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CLOSED: 'CLOSED',
} as const;
export type PoStatus = (typeof PO_STATUS)[keyof typeof PO_STATUS];

export const GRN_STATUS = { POSTED: 'POSTED' } as const;
export type GrnStatus = (typeof GRN_STATUS)[keyof typeof GRN_STATUS];

export const BILL_STATUS = {
  DRAFT: 'DRAFT',
  MATCH_EXCEPTION: 'MATCH_EXCEPTION',
  MATCHED: 'MATCHED',
  POSTED: 'POSTED',
} as const;
export type BillStatus = (typeof BILL_STATUS)[keyof typeof BILL_STATUS];

export const MATCH_LINE_STATUS = {
  OK: 'OK',
  EXCEPTION: 'EXCEPTION',
} as const;
export type MatchLineStatus = (typeof MATCH_LINE_STATUS)[keyof typeof MATCH_LINE_STATUS];

export interface MatchLine {
  readonly itemId: string;
  readonly poLineId: string;
  readonly qtyPo: string;
  readonly qtyGrn: string;
  readonly qtyBill: string;
  readonly pricePo: string;
  readonly priceBill: string;
  readonly qtyDiffPct: string;
  readonly priceDiffPct: string;
  readonly status: MatchLineStatus;
}

export interface MatchResult {
  readonly status: 'PASS' | 'EXCEPTION';
  readonly tolerance: { readonly qtyPct: string; readonly pricePct: string };
  readonly lines: readonly MatchLine[];
}

// Standard COA codes used to auto-post procurement journals (see seed-data DEFAULT_COA).
export const INVENTORY_ACCOUNT_CODE = '1300';
export const GRN_ACCRUAL_ACCOUNT_CODE = '2130';
export const AP_ACCOUNT_CODE = '2100';
export const PPN_INPUT_ACCOUNT_CODE = '2120';

export const OUTBOX_EVENT_TYPES = {
  PR_CREATED: 'procurement.pr_created',
  PO_CREATED: 'procurement.po_created',
  PO_SUBMITTED: 'procurement.po_submitted',
  PO_APPROVED: 'procurement.po_approved',
  GRN_POSTED: 'procurement.grn_posted',
  BILL_POSTED: 'procurement.bill_posted',
} as const;
