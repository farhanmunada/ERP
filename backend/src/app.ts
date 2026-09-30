import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';

import { env } from './core/config/env.ts';
import { loggerOptions } from './core/logger.ts';
import { registerErrorHandler } from './core/middleware/error-handler.ts';
import { iamRoutes } from './modules/iam/index.ts';
import { financeRoutes } from './modules/finance/index.ts';
import { approvalRoutes } from './modules/approval/index.ts';
import { inventoryRoutes } from './modules/inventory/index.ts';
import { procurementRoutes } from './modules/procurement/index.ts';
import { salesRoutes } from './modules/sales/index.ts';
import { checkHealth } from './core/health.ts';

export function buildApp() {
  const app = Fastify({ logger: loggerOptions });

  app.register(cookie);
  app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/ready', async (_request, reply) => {
    const report = await checkHealth();
    reply.status(report.status === 'ok' ? 200 : 503).send(report);
  });

  app.register(
    async (api) => {
      await iamRoutes(api);
      await financeRoutes(api);
      await approvalRoutes(api);
      await inventoryRoutes(api);
      await procurementRoutes(api);
      await salesRoutes(api);
    },
    { prefix: '/api/v1' },
  );

  registerErrorHandler(app);

  return app;
}
