import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { db } from '../database/client.ts';
import { ConflictError, ValidationError } from '../errors/app-error.ts';
import { idempotencyKeys } from '../../db/schema/shared.schema.ts';

const HEADER = 'idempotency-key';

export interface StoredIdempotentResponse {
  readonly status: number;
  readonly body: unknown;
}

export function hashRequest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
}

// Returns the previously stored response when the same key + payload is replayed.
export async function findReplay(
  key: string,
  userId: string,
  requestHash: string,
): Promise<StoredIdempotentResponse | null> {
  const rows = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.keyValue, key)).limit(1);
  const existing = rows[0];
  if (!existing) return null;

  if (existing.userId !== userId || existing.requestHash !== requestHash) {
    throw new ConflictError('Idempotency-Key sudah digunakan untuk request berbeda');
  }
  return { status: existing.responseStatus, body: existing.responseBody };
}

export async function storeResponse(
  key: string,
  userId: string,
  endpoint: string,
  requestHash: string,
  response: StoredIdempotentResponse,
): Promise<void> {
  await db.insert(idempotencyKeys).values({
    keyValue: key,
    userId,
    endpoint,
    requestHash,
    responseStatus: response.status,
    responseBody: response.body,
  });
}

export function readIdempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers[HEADER];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Guard for mutating endpoints: replay a stored response or require a key to proceed.
export async function idempotencyPreHandler(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const key = readIdempotencyKey(request);
  if (!key) throw new ValidationError('Header Idempotency-Key wajib untuk endpoint ini');

  const userId = request.authUser?.userId;
  if (!userId) throw new ValidationError('User tidak terautentikasi untuk idempotency');

  const replay = await findReplay(key, userId, hashRequest(request.body));
  if (replay) {
    // Stash the replay so the handler short-circuits.
    request.idempotentReplay = replay;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    idempotentReplay?: StoredIdempotentResponse;
  }
}
