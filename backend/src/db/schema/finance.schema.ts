import { boolean, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

import { createdAt, money, updatedAt, uuid } from './columns.ts';

// Chart of Accounts (hierarchical via parent_id).
export const accounts = mysqlTable(
  'accounts',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    code: varchar('code', { length: 20 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    parentId: uuid('parent_id'),
    type: varchar('type', { length: 20 }).notNull(),
    normalBalance: varchar('normal_balance', { length: 6 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_account_company_code').on(table.companyId, table.code),
    index('idx_account_parent').on(table.parentId),
  ],
);

// Append-only journal header. Corrections are made via reversal entries (reversal_of_id).
export const journalEntries = mysqlTable(
  'journal_entries',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    docNumber: varchar('doc_number', { length: 50 }).notNull(),
    entryDate: varchar('entry_date', { length: 10 }).notNull(),
    description: varchar('description', { length: 255 }).notNull(),
    sourceType: varchar('source_type', { length: 30 }).notNull(),
    sourceId: varchar('source_id', { length: 64 }),
    status: varchar('status', { length: 20 }).notNull(),
    reversalOfId: uuid('reversal_of_id'),
    postedAt: varchar('posted_at', { length: 30 }),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_journal_company_doc').on(table.companyId, table.docNumber),
    index('idx_journal_company_date').on(table.companyId, table.entryDate),
    index('idx_journal_source').on(table.sourceType, table.sourceId),
  ],
);

// Append-only journal lines (double-entry). debit/credit stored as DECIMAL(18,2) strings.
export const journalLines = mysqlTable(
  'journal_lines',
  {
    id: uuid('id').primaryKey(),
    entryId: uuid('entry_id').notNull(),
    accountId: uuid('account_id').notNull(),
    lineNumber: int('line_number').notNull(),
    debit: money('debit').notNull().default('0.00'),
    credit: money('credit').notNull().default('0.00'),
    description: varchar('description', { length: 255 }),
  },
  (table) => [
    index('idx_journal_line_entry').on(table.entryId),
    index('idx_journal_line_account').on(table.accountId),
  ],
);
