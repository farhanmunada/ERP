import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import { env } from '../config/env.ts';
import * as schema from '../../db/schema/index.ts';

export const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  connectionLimit: 10,
  timezone: 'Z',
  decimalNumbers: false,
  supportBigNumbers: true,
});

export const db = drizzle({ client: pool, schema, mode: 'default' });
export type Database = typeof db;
