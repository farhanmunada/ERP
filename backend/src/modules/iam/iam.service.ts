import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { ConflictError, UnauthorizedError } from '../../core/errors/app-error.ts';
import type { AuditLogInput } from '../../core/audit/audit-log.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { db } from '../../core/database/client.ts';
import { env } from '../../core/config/env.ts';
import * as repo from './iam.repository.ts';
import type { CreateCompanyInput, CreateUserInput, LoginInput } from './iam.schema.ts';

const REFRESH_TOKEN_BYTES = 32;

export interface LoginResult {
  readonly user: { id: string; companyId: string; email: string; fullName: string };
  readonly permissions: readonly string[];
  readonly refreshToken: string;
}

export interface AuditContext {
  readonly companyId: string;
  readonly userId: string | null;
  readonly ipAddress: string | null;
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function expiryIso(): string {
  return new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000).toISOString();
}

export async function login(companyId: string, input: LoginInput): Promise<LoginResult> {
  const user = await repo.findUserByEmail(companyId, input.email);
  if (!user || !user.isActive) throw new UnauthorizedError('Email atau password salah');

  const passwordValid = await Bun.password.verify(input.password, user.passwordHash);
  if (!passwordValid) throw new UnauthorizedError('Email atau password salah');

  const permissions = await repo.listUserPermissions(user.id);
  const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  await repo.insertRefreshToken({
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: expiryIso(),
  });

  return {
    user: { id: user.id, companyId: user.companyId, email: user.email, fullName: user.fullName },
    permissions,
    refreshToken,
  };
}

export async function rotateRefreshToken(rawToken: string): Promise<{ userId: string; refreshToken: string }> {
  const stored = await repo.findRefreshTokenByHash(hashToken(rawToken));
  if (!stored || stored.revokedAt || stored.expiresAt < new Date().toISOString()) {
    throw new UnauthorizedError('Refresh token tidak valid');
  }

  await repo.revokeRefreshToken(stored.tokenHash, new Date().toISOString());
  const nextToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  await repo.insertRefreshToken({
    id: randomUUID(),
    userId: stored.userId,
    tokenHash: hashToken(nextToken),
    expiresAt: expiryIso(),
  });
  return { userId: stored.userId, refreshToken: nextToken };
}

export async function logout(rawToken: string): Promise<void> {
  await repo.revokeRefreshToken(hashToken(rawToken), new Date().toISOString());
}

export async function listWarehouses(companyId: string) {
  return repo.listWarehouses(companyId);
}

export async function createCompany(input: CreateCompanyInput, ctx: AuditContext): Promise<string> {
  const existing = await repo.findCompanyByCode(input.code);
  if (existing) throw new ConflictError(`Kode company "${input.code}" sudah digunakan`);

  const id = randomUUID();
  await repo.insertCompany({ id, code: input.code, name: input.name });
  await writeAuditLog(db, auditOf(ctx, 'CREATE', 'company', id, null, input));
  return id;
}

export async function createUser(
  companyId: string,
  input: CreateUserInput,
  ctx: AuditContext,
): Promise<string> {
  const existing = await repo.findUserByEmail(companyId, input.email);
  if (existing) throw new ConflictError(`Email "${input.email}" sudah terdaftar`);

  const id = randomUUID();
  const passwordHash = await Bun.password.hash(input.password, { algorithm: 'argon2id' });
  await repo.insertUser({ id, companyId, email: input.email, fullName: input.fullName, passwordHash });
  await writeAuditLog(db, auditOf(ctx, 'CREATE', 'user', id, null, { email: input.email, fullName: input.fullName }));
  return id;
}

function auditOf(
  ctx: AuditContext,
  action: string,
  entityType: string,
  entityId: string,
  stateBefore: unknown,
  stateAfter: unknown,
): AuditLogInput {
  return {
    companyId: ctx.companyId,
    userId: ctx.userId,
    action,
    entityType,
    entityId,
    stateBefore,
    stateAfter,
    ipAddress: ctx.ipAddress,
  };
}
