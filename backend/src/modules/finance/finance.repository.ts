import { and, eq } from 'drizzle-orm';

import { db } from '../../core/database/client.ts';
import type { Database } from '../../core/database/client.ts';
import { accounts, journalEntries, journalLines } from '../../db/schema/finance.schema.ts';

export type TxExecutor = Pick<Database, 'select' | 'insert' | 'update'>;

export async function findAccountByCode(companyId: string, code: string) {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.companyId, companyId), eq(accounts.code, code)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findAccountById(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.companyId, companyId), eq(accounts.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAccounts(companyId: string) {
  return db.select().from(accounts).where(eq(accounts.companyId, companyId));
}

export async function insertAccount(values: typeof accounts.$inferInsert) {
  await db.insert(accounts).values(values);
}

export async function insertJournalEntry(tx: TxExecutor, values: typeof journalEntries.$inferInsert) {
  await tx.insert(journalEntries).values(values);
}

export async function insertJournalLines(tx: TxExecutor, values: (typeof journalLines.$inferInsert)[]) {
  await tx.insert(journalLines).values(values);
}

export async function findJournalEntry(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listJournalLines(entryId: string) {
  return db.select().from(journalLines).where(eq(journalLines.entryId, entryId));
}

export async function listJournalEntries(companyId: string) {
  return db.select().from(journalEntries).where(eq(journalEntries.companyId, companyId));
}

export async function listPostedLines(companyId: string) {
  return db
    .select({
      accountId: journalLines.accountId,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.status, 'POSTED')));
}
