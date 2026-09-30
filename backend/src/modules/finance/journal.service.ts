import { randomUUID } from 'node:crypto';

import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { db } from '../../core/database/client.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { buildReversalLines, validateJournalBalance } from './journal.validator.ts';
import * as repo from './finance.repository.ts';
import { JOURNAL_SOURCE, JOURNAL_STATUS } from './finance.types.ts';
import type { JournalInput } from './finance.types.ts';

export interface CreateJournalResult {
  readonly id: string;
  readonly docNumber: string;
}

// Posts a journal entry inside the caller's transaction, so inventory/procurement can stay atomic.
export async function postJournalTx(tx: Tx, input: JournalInput, createdBy: string): Promise<CreateJournalResult> {
  validateJournalBalance(input.lines);

  const id = randomUUID();
  const period = input.entryDate.slice(0, 4);
  const docNumber = await nextDocNumber(tx, {
    companyId: input.companyId,
    docType: 'JE',
    prefix: 'JE',
    period,
  });

  const now = new Date().toISOString();
  await repo.insertJournalEntry(tx, {
    id,
    companyId: input.companyId,
    docNumber,
    entryDate: input.entryDate,
    description: input.description,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    status: JOURNAL_STATUS.POSTED,
    postedAt: now,
    createdBy,
  });

  await repo.insertJournalLines(
    tx,
    input.lines.map((line, index) => ({
      id: randomUUID(),
      entryId: id,
      accountId: line.accountId,
      lineNumber: index + 1,
      debit: line.debit,
      credit: line.credit,
      description: line.description ?? null,
    })),
  );

  return { id, docNumber };
}

// Create + post a journal entry atomically. Append-only: no update/delete of posted rows.
export async function postJournal(input: JournalInput, createdBy: string): Promise<CreateJournalResult> {
  return db.transaction((tx) => postJournalTx(tx, input, createdBy));
}

// Reversal: create a new posted entry that swaps debit/credit, linked to the original.
export async function reverseJournal(companyId: string, entryId: string, createdBy: string): Promise<CreateJournalResult> {
  const original = await repo.findJournalEntry(companyId, entryId);
  if (!original) throw new NotFoundError('Journal Entry', entryId);
  if (original.status !== JOURNAL_STATUS.POSTED) throw new UnprocessableError('Hanya jurnal POSTED dapat di-reverse');

  const lines = await repo.listJournalLines(entryId);
  const reversalLines = buildReversalLines(
    lines.map((line) => ({ accountId: line.accountId, debit: line.debit, credit: line.credit })),
  );

  return db.transaction(async (tx) => {
    const id = randomUUID();
    const period = original.entryDate.slice(0, 4);
    const docNumber = await nextDocNumber(tx, { companyId, docType: 'JE', prefix: 'JE', period });

    await repo.insertJournalEntry(tx, {
      id,
      companyId,
      docNumber,
      entryDate: new Date().toISOString().slice(0, 10),
      description: `Reversal dari ${original.docNumber}`,
      sourceType: JOURNAL_SOURCE.REVERSAL,
      sourceId: original.id,
      status: JOURNAL_STATUS.POSTED,
      reversalOfId: original.id,
      postedAt: new Date().toISOString(),
      createdBy,
    });

    await repo.insertJournalLines(
      tx,
      reversalLines.map((line, index) => ({
        id: randomUUID(),
        entryId: id,
        accountId: line.accountId,
        lineNumber: index + 1,
        debit: line.debit,
        credit: line.credit,
        description: line.description ?? null,
      })),
    );

    return { id, docNumber };
  });
}
