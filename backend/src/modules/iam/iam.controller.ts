import type { FastifyReply, FastifyRequest } from 'fastify';

import { ValidationError } from '../../core/errors/app-error.ts';
import { ok } from '../../core/http/response.ts';
import { env } from '../../core/config/env.ts';
import * as service from './iam.service.ts';
import { createCompanySchema, createUserSchema, loginSchema } from './iam.schema.ts';

const REFRESH_COOKIE = 'erp_refresh';

interface CompanyParams {
  companyId: string;
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = loginSchema.parse(request.body);
  const companyId = ((request.headers['x-company-id'] as string | undefined) ?? '').trim();
  if (!companyId) {
    throw new ValidationError('Company ID wajib diisi', [{ field: 'x-company-id', issue: 'Header X-Company-Id kosong' }]);
  }
  const result = await service.login(companyId, body);

  reply.setCookie(REFRESH_COOKIE, result.refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: env.JWT_REFRESH_TTL_SECONDS,
  });

  const accessToken = await reply.jwtSign({
    sub: result.user.id,
    companyId: result.user.companyId,
    permissions: result.permissions,
  });

  reply.status(200).send(ok({ user: result.user, accessToken }));
}

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const raw = request.cookies[REFRESH_COOKIE];
  if (!raw) {
    reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Refresh token tidak ada', details: [] } });
    return;
  }

  const rotated = await service.rotateRefreshToken(raw);
  reply.setCookie(REFRESH_COOKIE, rotated.refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: env.JWT_REFRESH_TTL_SECONDS,
  });
  const accessToken = await reply.jwtSign({ sub: rotated.userId, companyId: request.authUser?.companyId ?? '' });
  reply.status(200).send(ok({ accessToken }));
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const raw = request.cookies[REFRESH_COOKIE];
  if (raw) await service.logout(raw);
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  reply.status(200).send(ok({ loggedOut: true }));
}

export async function createCompanyHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createCompanySchema.parse(request.body);
  const id = await service.createCompany(body, auditContext(request));
  reply.status(201).send(ok({ id }));
}

export async function createUserHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createUserSchema.parse(request.body);
  const auth = request.authUser;
  const id = await service.createUser(auth?.companyId ?? '', body, auditContext(request));
  reply.status(201).send(ok({ id }));
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(request.authUser ?? null));
}

export async function listWarehousesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await service.listWarehouses(request.authUser?.companyId ?? '')));
}

export function auditContext(request: FastifyRequest) {
  return {
    companyId: request.authUser?.companyId ?? ((request.headers['x-company-id'] as string | undefined) ?? ''),
    userId: request.authUser?.userId ?? null,
    ipAddress: request.ip,
  };
}

export type { CompanyParams };
