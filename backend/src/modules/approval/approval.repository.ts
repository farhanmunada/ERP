import { and, eq } from 'drizzle-orm';

import { db } from '../../core/database/client.ts';
import { approvalRequests, approvalRules } from '../../db/schema/iam.schema.ts';

export async function insertRule(values: typeof approvalRules.$inferInsert) {
  await db.insert(approvalRules).values(values);
}

export async function listRules(companyId: string, documentType: string) {
  return db
    .select()
    .from(approvalRules)
    .where(
      and(
        eq(approvalRules.companyId, companyId),
        eq(approvalRules.documentType, documentType),
        eq(approvalRules.isActive, true),
      ),
    );
}

export async function insertRequest(values: typeof approvalRequests.$inferInsert) {
  await db.insert(approvalRequests).values(values);
}

export async function findRequest(companyId: string, id: string) {
  const rows = await db
    .select()
    .from(approvalRequests)
    .where(and(eq(approvalRequests.companyId, companyId), eq(approvalRequests.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateRequest(
  id: string,
  values: Partial<typeof approvalRequests.$inferInsert>,
): Promise<void> {
  await db.update(approvalRequests).set(values).where(eq(approvalRequests.id, id));
}
