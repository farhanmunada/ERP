import { and, eq } from 'drizzle-orm';

import type { Database } from '../database/client.ts';
import { documentSequences } from '../../db/schema/shared.schema.ts';

// A transaction executor (has select/update/insert), so numbering participates in the caller's tx.
export type TxExecutor = Pick<Database, 'select' | 'update' | 'insert'>;

const SEQUENCE_PAD = 5;

export interface NextDocNumberInput {
  readonly companyId: string;
  readonly docType: string;
  readonly prefix: string;
  readonly period: string; // e.g. "2026"
}

// Atomic numbering: lock the sequence row with SELECT ... FOR UPDATE, then increment.
export async function nextDocNumber(tx: TxExecutor, input: NextDocNumberInput): Promise<string> {
  const where = and(
    eq(documentSequences.companyId, input.companyId),
    eq(documentSequences.docType, input.docType),
  );

  const rows = await tx
    .select({ nextNumber: documentSequences.nextNumber })
    .from(documentSequences)
    .where(where)
    .for('update');

  const current = rows[0]?.nextNumber ?? 1;

  if (rows.length === 0) {
    await tx.insert(documentSequences).values({
      companyId: input.companyId,
      docType: input.docType,
      prefix: input.prefix,
      nextNumber: current + 1,
    });
  } else {
    await tx.update(documentSequences).set({ nextNumber: current + 1 }).where(where);
  }

  return `${input.prefix}/${input.period}/${String(current).padStart(SEQUENCE_PAD, '0')}`;
}
