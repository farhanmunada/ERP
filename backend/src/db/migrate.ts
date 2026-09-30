import { migrate } from 'drizzle-orm/mysql2/migrator';

import { db, pool } from '../core/database/client.ts';

await migrate(db, { migrationsFolder: './src/db/migrations' });
await pool.end();
console.log('Migrasi selesai.');
