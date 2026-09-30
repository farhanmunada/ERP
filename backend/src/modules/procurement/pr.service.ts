import { randomUUID } from 'node:crypto';

import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import * as repo from './procurement.repository.ts';
import { PR_STATUS } from './procurement.types.ts';

export interface PrLineInput {
  readonly itemId: string;
  readonly qty: string;
  readonly notes?: string | null;
}

export interface CreatePrInput {
  readonly companyId: string;
  readonly prDate: string;
  readonly notes?: string | null;
  readonly lines: readonly PrLineInput[];
  readonly userId: string;
}

export interface PrResult {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
}

// Creates a Purchase Requisition in DRAFT (PRD Story 3.1).
export async function createPr(input: CreatePrInput): Promise<PrResult> {
  const period = input.prDate.slice(0, 4);
  return runInTransaction(async (tx) => {
    const id = randomUUID();
    const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'PR', prefix: 'PR', period });
    await repo.insertPr(tx, {
      id,
      companyId: input.companyId,
      docNumber,
      prDate: input.prDate,
      status: PR_STATUS.DRAFT,
      notes: input.notes ?? null,
      createdBy: input.userId,
    });
    await repo.insertPrLines(
      tx,
      input.lines.map((line) => ({ id: randomUUID(), prId: id, itemId: line.itemId, qty: line.qty, notes: line.notes ?? null })),
    );
    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: 'PR_CREATED',
      entityType: 'purchase_requisition',
      entityId: id,
      stateAfter: { docNumber, status: PR_STATUS.DRAFT },
    });
    return { id, docNumber, status: PR_STATUS.DRAFT };
  });
}

export function listPrs(companyId: string) {
  return repo.listPrs(companyId);
}

export async function getPr(companyId: string, id: string) {
  const pr = await repo.findPr(companyId, id);
  if (!pr) throw new NotFoundError('Purchase Requisition', id);
  const lines = await repo.listPrLines(id);
  return { ...pr, lines };
}

// PR approval is lightweight (no matrix); the PO carries the multi-tier matrix.
export async function approvePr(companyId: string, id: string, userId: string): Promise<PrResult> {
  return runInTransaction(async (tx) => {
    const pr = await repo.findPrForUpdate(tx, companyId, id);
    if (!pr) throw new NotFoundError('Purchase Requisition', id);
    if (pr.status !== PR_STATUS.DRAFT) throw new UnprocessableError(`PR berstatus ${pr.status} tidak dapat disetujui`);
    await repo.updatePrStatus(tx, id, PR_STATUS.APPROVED);
    await writeAuditLog(tx, {
      companyId,
      userId,
      action: 'PR_APPROVED',
      entityType: 'purchase_requisition',
      entityId: id,
      stateAfter: { status: PR_STATUS.APPROVED },
    });
    return { id, docNumber: pr.docNumber, status: PR_STATUS.APPROVED };
  });
}
