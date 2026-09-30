import { and, eq } from 'drizzle-orm';

import { db } from '../../core/database/client.ts';
import {
  branches,
  companies,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  userRoles,
  userScopes,
  users,
  warehouses,
} from '../../db/schema/iam.schema.ts';

export async function findUserByEmail(companyId: string, email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.email, email)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserById(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function listUserPermissions(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ code: permissions.code })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId));
  return rows.map((row) => row.code);
}

export async function listUserScopes(userId: string) {
  return db.select().from(userScopes).where(eq(userScopes.userId, userId));
}

export async function insertUser(values: typeof users.$inferInsert) {
  await db.insert(users).values(values);
}

export async function insertCompany(values: typeof companies.$inferInsert) {
  await db.insert(companies).values(values);
}

export async function findCompanyByCode(code: string) {
  const rows = await db.select().from(companies).where(eq(companies.code, code)).limit(1);
  return rows[0] ?? null;
}

export async function listCompanies() {
  return db.select().from(companies);
}

export async function insertBranch(values: typeof branches.$inferInsert) {
  await db.insert(branches).values(values);
}

export async function insertWarehouse(values: typeof warehouses.$inferInsert) {
  await db.insert(warehouses).values(values);
}

export async function insertRole(values: typeof roles.$inferInsert) {
  await db.insert(roles).values(values);
}

export async function insertRefreshToken(values: typeof refreshTokens.$inferInsert) {
  await db.insert(refreshTokens).values(values);
}

export async function findRefreshTokenByHash(tokenHash: string) {
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);
  return rows[0] ?? null;
}

export async function revokeRefreshToken(tokenHash: string, revokedAt: string) {
  await db.update(refreshTokens).set({ revokedAt }).where(eq(refreshTokens.tokenHash, tokenHash));
}
