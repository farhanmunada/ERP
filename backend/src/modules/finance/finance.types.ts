export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const NORMAL_BALANCE = ['DEBIT', 'CREDIT'] as const;
export type NormalBalance = (typeof NORMAL_BALANCE)[number];

export const JOURNAL_STATUS = { DRAFT: 'DRAFT', POSTED: 'POSTED' } as const;
export type JournalStatus = (typeof JOURNAL_STATUS)[keyof typeof JOURNAL_STATUS];

export const JOURNAL_SOURCE = {
  MANUAL: 'MANUAL',
  INVENTORY: 'INVENTORY',
  PROCUREMENT: 'PROCUREMENT',
  SALES: 'SALES',
  REVERSAL: 'REVERSAL',
} as const;
export type JournalSource = (typeof JOURNAL_SOURCE)[keyof typeof JOURNAL_SOURCE];

export interface JournalLineInput {
  readonly accountId: string;
  readonly debit: string;
  readonly credit: string;
  readonly description?: string;
}

export interface JournalInput {
  readonly companyId: string;
  readonly entryDate: string;
  readonly description: string;
  readonly sourceType: JournalSource;
  readonly sourceId?: string | null;
  readonly lines: readonly JournalLineInput[];
}
