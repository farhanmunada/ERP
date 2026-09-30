import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { db, pool } from '../core/database/client.ts';
import {
  accounts,
  branches,
  companies,
  items,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
  warehouses,
} from '../db/schema/index.ts';
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_BRANCH,
  DEFAULT_BRANCH_ID,
  DEFAULT_COA,
  DEFAULT_COMPANY_ID,
  DEFAULT_ITEMS,
  DEFAULT_WAREHOUSES,
  PERMISSIONS,
} from './seed-data.ts';

const ADMIN_ROLE_CODE = 'ADMIN';
const CREDIT_NORMAL_TYPES = new Set(['LIABILITY', 'EQUITY', 'REVENUE']);

async function seed(): Promise<void> {
  console.log('[seed] Company...');
  await db
    .insert(companies)
    .values({ id: DEFAULT_COMPANY_ID, code: 'DEMO', name: 'PT Demo Retail' })
    .onDuplicateKeyUpdate({ set: { name: 'PT Demo Retail' } });

  console.log('[seed] Permissions...');
  for (const permission of PERMISSIONS) {
    await db
      .insert(permissions)
      .values({ id: randomUUID(), code: permission.code, description: permission.description })
      .onDuplicateKeyUpdate({ set: { description: permission.description } });
  }
  const allPermissions = await db.select().from(permissions);

  console.log('[seed] Admin role + mapping...');
  let adminRole = (await db.select().from(roles).where(eq(roles.code, ADMIN_ROLE_CODE)).limit(1))[0];
  if (!adminRole) {
    const roleId = randomUUID();
    await db.insert(roles).values({ id: roleId, companyId: DEFAULT_COMPANY_ID, code: ADMIN_ROLE_CODE, name: 'Administrator' });
    adminRole = (await db.select().from(roles).where(eq(roles.id, roleId)).limit(1))[0];
  }
  if (!adminRole) throw new Error('Gagal membuat role admin');

  for (const permission of allPermissions) {
    await db
      .insert(rolePermissions)
      .values({ roleId: adminRole.id, permissionId: permission.id })
      .onDuplicateKeyUpdate({ set: { roleId: adminRole.id } });
  }

  console.log('[seed] Admin user...');
  const passwordHash = await Bun.password.hash(DEFAULT_ADMIN_PASSWORD, { algorithm: 'argon2id' });
  let adminUser = (
    await db
      .select()
      .from(users)
      .where(eq(users.email, DEFAULT_ADMIN_EMAIL))
      .limit(1)
  )[0];
  if (!adminUser) {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      companyId: DEFAULT_COMPANY_ID,
      email: DEFAULT_ADMIN_EMAIL,
      fullName: 'Administrator',
      passwordHash,
    });
    adminUser = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  }
  if (!adminUser) throw new Error('Gagal membuat user admin');

  await db
    .insert(userRoles)
    .values({ userId: adminUser.id, roleId: adminRole.id })
    .onDuplicateKeyUpdate({ set: { roleId: adminRole.id } });

  console.log('[seed] Default COA...');
  for (const account of DEFAULT_COA) {
    await db
      .insert(accounts)
      .values({
        id: randomUUID(),
        companyId: DEFAULT_COMPANY_ID,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: CREDIT_NORMAL_TYPES.has(account.type) ? 'CREDIT' : 'DEBIT',
      })
      .onDuplicateKeyUpdate({ set: { name: account.name } });
  }

  console.log('[seed] Branch + warehouse...');
  await db
    .insert(branches)
    .values({ id: DEFAULT_BRANCH_ID, companyId: DEFAULT_COMPANY_ID, code: DEFAULT_BRANCH.code, name: DEFAULT_BRANCH.name })
    .onDuplicateKeyUpdate({ set: { name: DEFAULT_BRANCH.name } });

  for (const warehouse of DEFAULT_WAREHOUSES) {
    await db
      .insert(warehouses)
      .values({
        id: warehouse.id,
        companyId: DEFAULT_COMPANY_ID,
        branchId: DEFAULT_BRANCH_ID,
        code: warehouse.code,
        name: warehouse.name,
      })
      .onDuplicateKeyUpdate({ set: { name: warehouse.name } });
  }

  console.log('[seed] Master items...');
  for (const item of DEFAULT_ITEMS) {
    await db
      .insert(items)
      .values({
        id: randomUUID(),
        companyId: DEFAULT_COMPANY_ID,
        code: item.code,
        name: item.name,
        uom: item.uom,
        costingMethod: item.costingMethod,
        trackBatch: item.trackBatch,
        trackSerial: item.trackSerial,
        reorderPoint: item.reorderPoint,
      })
      .onDuplicateKeyUpdate({ set: { name: item.name, costingMethod: item.costingMethod } });
  }

  console.log('\n[seed] Selesai.');
  console.log(`  Company ID : ${DEFAULT_COMPANY_ID}`);
  console.log(`  Email      : ${DEFAULT_ADMIN_EMAIL}`);
  console.log(`  Password   : ${DEFAULT_ADMIN_PASSWORD}`);
}

await seed();
await pool.end();
