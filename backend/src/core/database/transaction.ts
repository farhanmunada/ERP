import { db } from './client.ts';

// Drizzle transaction handle, so repositories can participate in the caller's transaction.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 50;

function isDeadlock(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { errno?: number; code?: string };
  return candidate.errno === 1213 || candidate.code === 'ER_LOCK_DEADLOCK';
}

// Retries a transaction on MySQL deadlock (error 1213) with linear backoff (ARCHITECTURE §4.1).
export async function runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await db.transaction(work);
    } catch (error) {
      if (!isDeadlock(error)) throw error;
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, BASE_BACKOFF_MS * attempt));
    }
  }

  throw lastError;
}
