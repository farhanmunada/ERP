import { sql } from 'drizzle-orm';

import { db, pool } from './database/client.ts';

export interface HealthReport {
  readonly status: 'ok' | 'degraded';
  readonly dependencies: Record<string, boolean>;
}

async function pingDatabase(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function checkHealth(): Promise<HealthReport> {
  const database = await pingDatabase();
  return {
    status: database ? 'ok' : 'degraded',
    dependencies: { database },
  };
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
