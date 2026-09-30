import type { Database } from '../database/client.ts';
import { auditLogs } from '../../db/schema/shared.schema.ts';

// A transaction or the root db can write audit rows.
export type DbExecutor = Pick<Database, 'insert'>;

export interface AuditLogInput {
  readonly companyId: string;
  readonly userId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly stateBefore?: unknown;
  readonly stateAfter?: unknown;
  readonly ipAddress?: string | null;
}

export async function writeAuditLog(executor: DbExecutor, input: AuditLogInput): Promise<void> {
  await executor.insert(auditLogs).values({
    companyId: input.companyId,
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    stateBefore: input.stateBefore ?? null,
    stateAfter: input.stateAfter ?? null,
    ipAddress: input.ipAddress ?? null,
  });
}
