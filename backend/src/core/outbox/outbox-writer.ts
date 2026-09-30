import { randomUUID } from 'node:crypto';

import type { Database } from '../database/client.ts';
import { outboxEvents } from '../../db/schema/shared.schema.ts';

export type DbExecutor = Pick<Database, 'insert'>;

export interface DomainEventInput {
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;
}

// Must be called inside the same transaction as the business write (transactional outbox).
export async function writeOutboxEvent(executor: DbExecutor, input: DomainEventInput): Promise<string> {
  const eventId = randomUUID();
  await executor.insert(outboxEvents).values({
    eventId,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
  });
  return eventId;
}
