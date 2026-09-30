import { bigint, index, json, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

import { createdAt, uuid } from './columns.ts';

// Global audit trail: single generic table (before/after state as JSON).
export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    companyId: uuid('company_id').notNull(),
    userId: uuid('user_id'),
    action: varchar('action', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 64 }).notNull(),
    stateBefore: json('state_before'),
    stateAfter: json('state_after'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_audit_entity').on(table.entityType, table.entityId),
    index('idx_audit_company_created').on(table.companyId, table.createdAt),
  ],
);

// Transactional outbox: written in the same DB transaction as business data.
// Relay to a broker (RabbitMQ) is deferred to P1 — see docs/ADR/0002-tanpa-docker-lokal.md.
export const outboxEvents = mysqlTable(
  'outbox_events',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    eventId: uuid('event_id').notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    aggregateType: varchar('aggregate_type', { length: 50 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 64 }).notNull(),
    payload: json('payload').notNull(),
    publishedAt: varchar('published_at', { length: 30 }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_outbox_event_id').on(table.eventId),
    index('idx_outbox_unpublished').on(table.publishedAt, table.createdAt),
  ],
);

// Consumer-side idempotency: one row per processed event id.
export const processedEvents = mysqlTable(
  'processed_events',
  {
    eventId: uuid('event_id').primaryKey(),
    processedAt: varchar('processed_at', { length: 30 }).notNull(),
  },
);

// Request idempotency: unique key from the client, stores the original response.
export const idempotencyKeys = mysqlTable(
  'idempotency_keys',
  {
    keyValue: varchar('key_value', { length: 255 }).primaryKey(),
    userId: uuid('user_id').notNull(),
    endpoint: varchar('endpoint', { length: 200 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    responseStatus: bigint('response_status', { mode: 'number', unsigned: true }).notNull(),
    responseBody: json('response_body').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('idx_idempotency_created').on(table.createdAt)],
);

// Document numbering: one row per company + doc type, locked with SELECT ... FOR UPDATE.
export const documentSequences = mysqlTable(
  'document_sequences',
  {
    companyId: uuid('company_id').notNull(),
    docType: varchar('doc_type', { length: 30 }).notNull(),
    prefix: varchar('prefix', { length: 20 }).notNull(),
    nextNumber: bigint('next_number', { mode: 'number', unsigned: true }).notNull().default(1),
  },
  (table) => [uniqueIndex('uq_doc_seq').on(table.companyId, table.docType)],
);
