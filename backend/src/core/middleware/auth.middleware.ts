import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../errors/app-error.ts';

export interface AuthUser {
  readonly userId: string;
  readonly companyId: string;
  readonly permissions: readonly string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const payload = await request.jwtVerify<{ sub: string; companyId: string; permissions: string[] }>();
    request.authUser = {
      userId: payload.sub,
      companyId: payload.companyId,
      permissions: payload.permissions ?? [],
    };
  } catch {
    throw new UnauthorizedError('Token tidak valid atau kedaluwarsa');
  }
}
