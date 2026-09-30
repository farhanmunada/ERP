import { and, asc, eq, isNull } from 'drizzle-orm';

import { db } from '../database/client.ts';
import { outboxEvents } from '../../db/schema/shared.schema.ts';
import { publishEvent } from './rabbit-publisher.ts';

const BATCH_SIZE = 50;

export interface RelayResult {
  readonly published: number;
}

// Claims a batch of unpublished events with SKIP LOCKED (safe for multiple relay instances),
// publishes them, then marks them published inside the same transaction.
export async function relayBatch(): Promise<RelayResult> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .select()
      .from(outboxEvents)
      .where(and(isNull(outboxEvents.publishedAt)))
      .orderBy(asc(outboxEvents.id))
      .limit(BATCH_SIZE)
      .for('update', { skipLocked: true });

    if (claimed.length === 0) return { published: 0 };

    const now = new Date().toISOString();
    for (const event of claimed) {
      await publishEvent(event.eventType, {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
      });
      await tx.update(outboxEvents).set({ publishedAt: now }).where(eq(outboxEvents.eventId, event.eventId));
    }

    return { published: claimed.length };
  });
}

export async function runRelayLoop(intervalMs: number, signal?: AbortSignal): Promise<void> {
  while (!signal?.aborted) {
    try {
      await relayBatch();
    } catch (error) {
      console.error('[outbox-relay] batch gagal:', error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
