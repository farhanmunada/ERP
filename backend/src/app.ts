import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';

import { env } from './core/config/env.ts';
import { loggerOptions } from './core/logger.ts';
import { registerErrorHandler } from './core/middleware/error-handler.ts';

export function buildApp() {
  const app = Fastify({ logger: loggerOptions });

  app.register(cookie);
  app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
  });

  app.get('/health', async () => ({ status: 'ok' }));

  registerErrorHandler(app);

  return app;
}
