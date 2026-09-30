import { boolean, index, int, json, mysqlTable, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

import { createdAt, updatedAt, uuid } from './columns.ts';

// --- Organization hierarchy: company -> branch -> warehouse ---
export const companies = mysqlTable(
  'companies',
  {
    id: uuid('id').primaryKey(),
    code: varchar('code', { length: 20 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('uq_company_code').on(table.code)],
);

export const branches = mysqlTable(
  'branches',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    code: varchar('code', { length: 20 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_branch_company_code').on(table.companyId, table.code),
    index('idx_branch_company').on(table.companyId),
  ],
);

export const warehouses = mysqlTable(
  'warehouses',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    branchId: uuid('branch_id').notNull(),
    code: varchar('code', { length: 20 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_warehouse_branch_code').on(table.branchId, table.code),
    index('idx_warehouse_company').on(table.companyId),
  ],
);

// --- Identity ---
export const users = mysqlTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    email: varchar('email', { length: 150 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('uq_user_company_email').on(table.companyId, table.email)],
);

export const roles = mysqlTable(
  'roles',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('uq_role_company_code').on(table.companyId, table.code)],
);

export const permissions = mysqlTable(
  'permissions',
  {
    id: uuid('id').primaryKey(),
    code: varchar('code', { length: 80 }).notNull(),
    description: varchar('description', { length: 200 }).notNull(),
  },
  (table) => [uniqueIndex('uq_permission_code').on(table.code)],
);

export const rolePermissions = mysqlTable(
  'role_permissions',
  {
    roleId: uuid('role_id').notNull(),
    permissionId: uuid('permission_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const userRoles = mysqlTable(
  'user_roles',
  {
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

// Org-unit scope: a user may be limited to a company/branch/warehouse.
export const userScopes = mysqlTable(
  'user_scopes',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    scopeType: varchar('scope_type', { length: 20 }).notNull(),
    scopeId: uuid('scope_id').notNull(),
  },
  (table) => [index('idx_user_scope_user').on(table.userId)],
);

export const refreshTokens = mysqlTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    expiresAt: varchar('expires_at', { length: 30 }).notNull(),
    revokedAt: varchar('revoked_at', { length: 30 }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('uq_refresh_token_hash').on(table.tokenHash), index('idx_refresh_user').on(table.userId)],
);

// --- Dynamic multi-tier approval matrix ---
export const approvalRules = mysqlTable(
  'approval_rules',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    documentType: varchar('document_type', { length: 30 }).notNull(),
    minAmount: varchar('min_amount', { length: 30 }).notNull(),
    maxAmount: varchar('max_amount', { length: 30 }),
    levels: json('levels').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('idx_approval_rule_lookup').on(table.companyId, table.documentType)],
);

export const approvalRequests = mysqlTable(
  'approval_requests',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    documentType: varchar('document_type', { length: 30 }).notNull(),
    documentId: uuid('document_id').notNull(),
    ruleId: uuid('rule_id').notNull(),
    currentLevel: int('current_level').notNull().default(1),
    totalLevels: int('total_levels').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    history: json('history').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('idx_approval_doc').on(table.documentType, table.documentId)],
);
