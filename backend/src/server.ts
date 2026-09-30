import { buildApp } from './app.ts';
import { env } from './core/config/env.ts';

const app = buildApp();

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error({ err: error }, 'Gagal menjalankan server');
  process.exit(1);
}
