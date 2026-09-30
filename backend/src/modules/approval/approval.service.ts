import { randomUUID } from 'node:crypto';

import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { db } from '../../core/database/client.ts';
import { advanceApproval, selectRule } from './approval.logic.ts';
import { APPROVAL_STATUS } from './approval.types.ts';
import type { ApprovalHistoryEntry, ApprovalLevel } from './approval.types.ts';
import * as repo from './approval.repository.ts';

export interface CreateRuleInput {
  readonly companyId: string;
  readonly documentType: string;
  readonly minAmount: string;
  readonly maxAmount: string | null;
  readonly levels: readonly ApprovalLevel[];
}

export async function createRule(input: CreateRuleInput): Promise<string> {
  if (input.levels.length === 0) throw new UnprocessableError('Rule approval harus punya minimal 1 level');

  const id = randomUUID();
  await repo.insertRule({
    id,
    companyId: input.companyId,
    documentType: input.documentType,
    minAmount: input.minAmount,
    maxAmount: input.maxAmount,
    levels: [...input.levels],
  });
  return id;
}

export interface SubmitInput {
  readonly companyId: string;
  readonly documentType: string;
  readonly documentId: string;
  readonly amount: string;
  readonly userId: string;
}

// Returns the matching rule (or null) so callers can auto-approve when no matrix applies.
export async function selectApprovalRule(companyId: string, documentType: string, amount: string) {
  const rules = await repo.listRules(companyId, documentType);
  return selectRule(
    rules.map((row) => ({
      id: row.id,
      minAmount: row.minAmount,
      maxAmount: row.maxAmount,
      levels: row.levels as ApprovalLevel[],
    })),
    amount,
  );
}

export async function submitForApproval(input: SubmitInput): Promise<string> {
  const rules = await repo.listRules(input.companyId, input.documentType);
  const rule = selectRule(
    rules.map((row) => ({
      id: row.id,
      minAmount: row.minAmount,
      maxAmount: row.maxAmount,
      levels: row.levels as ApprovalLevel[],
    })),
    input.amount,
  );

  if (!rule) throw new UnprocessableError('Tidak ada rule approval yang cocok untuk nominal ini');

  const id = randomUUID();
  const history: ApprovalHistoryEntry[] = [
    { level: 1, action: 'SUBMIT', userId: input.userId, at: new Date().toISOString() },
  ];

  await repo.insertRequest({
    id,
    companyId: input.companyId,
    documentType: input.documentType,
    documentId: input.documentId,
    ruleId: rule.id,
    currentLevel: 1,
    totalLevels: rule.levels.length,
    status: APPROVAL_STATUS.PENDING,
    history,
  });

  await writeAuditLog(db, {
    companyId: input.companyId,
    userId: input.userId,
    action: 'SUBMIT',
    entityType: input.documentType,
    entityId: input.documentId,
    stateAfter: { approvalRequestId: id, status: APPROVAL_STATUS.PENDING },
  });

  return id;
}

export interface DecideInput {
  readonly companyId: string;
  readonly requestId: string;
  readonly action: 'APPROVE' | 'REJECT';
  readonly userId: string;
  readonly note?: string;
}

// Resolves the active approval request for a business document (used by PO submit/approve).
export async function findApprovalByDocument(companyId: string, documentType: string, documentId: string) {
  return repo.findRequestByDocument(companyId, documentType, documentId);
}

export interface DecideResult {
  readonly status: string;
  readonly currentLevel: number;
  readonly totalLevels: number;
}

export async function decide(input: DecideInput): Promise<DecideResult> {
  const request = await repo.findRequest(input.companyId, input.requestId);
  if (!request) throw new NotFoundError('Approval Request', input.requestId);
  if (request.status !== APPROVAL_STATUS.PENDING) {
    throw new UnprocessableError(`Approval sudah berstatus ${request.status}`);
  }

  const transition = advanceApproval(input.action, request.currentLevel, request.totalLevels);
  const history = [
    ...(request.history as ApprovalHistoryEntry[]),
    {
      level: request.currentLevel,
      action: input.action,
      userId: input.userId,
      at: new Date().toISOString(),
      ...(input.note ? { note: input.note } : {}),
    },
  ];

  await repo.updateRequest(request.id, {
    currentLevel: transition.nextLevel,
    status: transition.status,
    history,
  });

  await writeAuditLog(db, {
    companyId: input.companyId,
    userId: input.userId,
    action: input.action,
    entityType: request.documentType,
    entityId: request.documentId,
    stateBefore: { status: request.status, level: request.currentLevel },
    stateAfter: { status: transition.status, level: transition.nextLevel },
  });

  return {
    status: transition.status,
    currentLevel: transition.nextLevel,
    totalLevels: request.totalLevels,
  };
}
