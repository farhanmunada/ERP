import { defineConfig } from 'drizzle-kit';

import { env } from './src/core/config/env.ts';

export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: { url: env.DATABASE_URL },
  strict: true,
  verbose: true,
});
