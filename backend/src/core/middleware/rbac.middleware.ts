import type { FastifyReply, FastifyRequest } from 'fastify';

import { ForbiddenError } from '../errors/app-error.ts';

// Route-level permission guard. Usage: preHandler: [authenticate, requirePermission('po:approve')].
export function requirePermission(permissionCode: string) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const granted = request.authUser?.permissions ?? [];
    if (!granted.includes(permissionCode)) {
      throw new ForbiddenError(`Permission "${permissionCode}" diperlukan`);
    }
  };
}
