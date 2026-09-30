export const QUOTATION_STATUS = {
  DRAFT: 'DRAFT',
  ACCEPTED: 'ACCEPTED',
  CONVERTED: 'CONVERTED',
} as const;
export type QuotationStatus = (typeof QUOTATION_STATUS)[keyof typeof QUOTATION_STATUS];

export const SO_STATUS = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  PARTIALLY_DELIVERED: 'PARTIALLY_DELIVERED',
  DELIVERED: 'DELIVERED',
  INVOICED: 'INVOICED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type SoStatus = (typeof SO_STATUS)[keyof typeof SO_STATUS];

export const DO_STATUS = { POSTED: 'POSTED' } as const;
export type DoStatus = (typeof DO_STATUS)[keyof typeof DO_STATUS];

export const INVOICE_STATUS = { POSTED: 'POSTED', VOID: 'VOID' } as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

// Standard COA codes used to auto-post sales journals (see seed-data DEFAULT_COA).
export const AR_ACCOUNT_CODE = '1200';
export const PPN_OUTPUT_ACCOUNT_CODE = '2110';
export const SALES_REVENUE_ACCOUNT_CODE = '4100';
export const COGS_ACCOUNT_CODE = '5100';
export const INVENTORY_ACCOUNT_CODE = '1300';

export const OUTBOX_EVENT_TYPES = {
  QUOTATION_CREATED: 'sales.quotation_created',
  SO_CREATED: 'sales.so_created',
  SO_CONFIRMED: 'sales.so_confirmed',
  DO_POSTED: 'sales.do_posted',
  INVOICE_POSTED: 'sales.invoice_posted',
  INVOICE_VOIDED: 'sales.invoice_voided',
  CREDIT_NOTE_POSTED: 'sales.credit_note_posted',
} as const;
