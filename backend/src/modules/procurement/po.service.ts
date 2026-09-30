import { randomUUID } from 'node:crypto';

import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { itemExists } from '../inventory/index.ts';
import {
  decide as decideApproval,
  findApprovalByDocument,
  selectApprovalRule,
  submitForApproval,
  APPROVAL_STATUS,
} from '../approval/index.ts';
import { computeAmounts } from './amounts.ts';
import * as repo from './procurement.repository.ts';
import { OUTBOX_EVENT_TYPES, PO_STATUS, PR_STATUS } from './procurement.types.ts';
import { requireVendor } from './vendor.service.ts';

const APPROVAL_DOCUMENT_TYPE = 'PURCHASE_ORDER';

export interface PoLineInput {
  readonly itemId: string;
  readonly qty: string;
  readonly unitPrice: string;
}

export interface CreatePoInput {
  readonly companyId: string;
  readonly poDate: string;
  readonly vendorId: string;
  readonly warehouseId: string;
  readonly tax: string;
  readonly lines: readonly PoLineInput[];
  readonly prId?: string | null;
  readonly userId: string;
}

export interface PoResult {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
  readonly total: string;
}

async function assertItemsExist(companyId: string, lines: readonly PoLineInput[]): Promise<void> {
  for (const line of lines) {
    if (!(await itemExists(companyId, line.itemId))) throw new NotFoundError('Item', line.itemId);
  }
}

// Inserts a PO header + lines inside a tx; shared by direct creation and PR conversion.
async function insertPoWithLines(
  tx: Tx,
  input: CreatePoInput,
  prId: string | null,
): Promise<PoResult> {
  const period = input.poDate.slice(0, 4);
  const id = randomUUID();
  const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'PO', prefix: 'PO', period });
  const amounts = computeAmounts(input.lines, input.tax);

  await repo.insertPo(tx, {
    id,
    companyId: input.companyId,
    docNumber,
    poDate: input.poDate,
    vendorId: input.vendorId,
    warehouseId: input.warehouseId,
    status: PO_STATUS.DRAFT,
    prId,
    subtotal: amounts.subtotal,
    tax: amounts.tax,
    total: amounts.total,
    createdBy: input.userId,
  });
  await repo.insertPoLines(
    tx,
    input.lines.map((line) => ({
      id: randomUUID(),
      poId: id,
      itemId: line.itemId,
      qty: line.qty,
      unitPrice: line.unitPrice,
    })),
  );
  await writeOutboxEvent(tx, {
    eventType: OUTBOX_EVENT_TYPES.PO_CREATED,
    aggregateType: 'purchase_order',
    aggregateId: id,
    payload: { docNumber, total: amounts.total },
  });
  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    action: 'PO_CREATED',
    entityType: 'purchase_order',
    entityId: id,
    stateAfter: { docNumber, status: PO_STATUS.DRAFT, total: amounts.total },
  });

  return { id, docNumber, status: PO_STATUS.DRAFT, total: amounts.total };
}

export async function createPo(input: CreatePoInput): Promise<PoResult> {
  await requireVendor(input.companyId, input.vendorId);
  await assertItemsExist(input.companyId, input.lines);
  return runInTransaction((tx) => insertPoWithLines(tx, input, input.prId ?? null));
}

export interface ConvertPrInput {
  readonly companyId: string;
  readonly prId: string;
  readonly vendorId: string;
  readonly warehouseId: string;
  readonly poDate: string;
  readonly tax: string;
  readonly lines: readonly PoLineInput[];
  readonly userId: string;
}

// Converts an APPROVED PR into a PO and marks the PR CONVERTED (PRD Story 3.1.1).
export async function convertPrToPo(input: ConvertPrInput): Promise<PoResult> {
  await requireVendor(input.companyId, input.vendorId);
  await assertItemsExist(input.companyId, input.lines);

  return runInTransaction(async (tx) => {
    const pr = await repo.findPrForUpdate(tx, input.companyId, input.prId);
    if (!pr) throw new NotFoundError('Purchase Requisition', input.prId);
    if (pr.status !== PR_STATUS.APPROVED) {
      throw new UnprocessableError(`PR berstatus ${pr.status} tidak dapat dikonversi ke PO`);
    }

    const result = await insertPoWithLines(
      tx,
      {
        companyId: input.companyId,
        poDate: input.poDate,
        vendorId: input.vendorId,
        warehouseId: input.warehouseId,
        tax: input.tax,
        lines: input.lines,
        userId: input.userId,
      },
      input.prId,
    );
    await repo.updatePrStatus(tx, input.prId, PR_STATUS.CONVERTED);
    return result;
  });
}

// Submit a PO into the approval matrix. With no matching rule the PO is approved immediately.
export async function submitPo(companyId: string, poId: string, userId: string): Promise<PoResult> {
  const po = await repo.findPo(companyId, poId);
  if (!po) throw new NotFoundError('Purchase Order', poId);
  if (po.status !== PO_STATUS.DRAFT) throw new UnprocessableError(`PO berstatus ${po.status} tidak dapat disubmit`);

  const rule = await selectApprovalRule(companyId, APPROVAL_DOCUMENT_TYPE, po.total);

  if (!rule) {
    await runInTransaction(async (tx) => {
      await repo.updatePoStatus(tx, poId, { status: PO_STATUS.APPROVED });
      await writeAuditLog(tx, {
        companyId,
        userId,
        action: 'PO_APPROVED',
        entityType: 'purchase_order',
        entityId: poId,
        stateAfter: { status: PO_STATUS.APPROVED, auto: true },
      });
    });
    return { id: poId, docNumber: po.docNumber, status: PO_STATUS.APPROVED, total: po.total };
  }

  const requestId = await submitForApproval({
    companyId,
    documentType: APPROVAL_DOCUMENT_TYPE,
    documentId: poId,
    amount: po.total,
    userId,
  });

  await runInTransaction(async (tx) => {
    await repo.updatePoStatus(tx, poId, { status: PO_STATUS.PENDING_APPROVAL, approvalRequestId: requestId });
    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.PO_SUBMITTED,
      aggregateType: 'purchase_order',
      aggregateId: poId,
      payload: { approvalRequestId: requestId, total: po.total },
    });
    await writeAuditLog(tx, {
      companyId,
      userId,
      action: 'PO_SUBMITTED',
      entityType: 'purchase_order',
      entityId: poId,
      stateAfter: { status: PO_STATUS.PENDING_APPROVAL, approvalRequestId: requestId },
    });
  });

  return { id: poId, docNumber: po.docNumber, status: PO_STATUS.PENDING_APPROVAL, total: po.total };
}

async function decidePo(
  companyId: string,
  poId: string,
  action: 'APPROVE' | 'REJECT',
  userId: string,
  note?: string,
): Promise<PoResult> {
  const po = await repo.findPo(companyId, poId);
  if (!po) throw new NotFoundError('Purchase Order', poId);
  if (po.status !== PO_STATUS.PENDING_APPROVAL) {
    throw new UnprocessableError(`PO berstatus ${po.status} tidak dalam alur approval`);
  }

  const request = await findApprovalByDocument(companyId, APPROVAL_DOCUMENT_TYPE, poId);
  if (!request) throw new UnprocessableError('Approval request PO tidak ditemukan');

  const decision = await decideApproval({ companyId, requestId: request.id, action, userId, ...(note ? { note } : {}) });

  const nextStatus =
    decision.status === APPROVAL_STATUS.APPROVED
      ? PO_STATUS.APPROVED
      : decision.status === APPROVAL_STATUS.REJECTED
        ? PO_STATUS.REJECTED
        : PO_STATUS.PENDING_APPROVAL;

  if (nextStatus !== PO_STATUS.PENDING_APPROVAL) {
    await runInTransaction(async (tx) => {
      await repo.updatePoStatus(tx, poId, { status: nextStatus });
      await writeAuditLog(tx, {
        companyId,
        userId,
        action: `PO_${action}D`,
        entityType: 'purchase_order',
        entityId: poId,
        stateAfter: { status: nextStatus, level: decision.currentLevel },
      });
    });
  }

  return { id: poId, docNumber: po.docNumber, status: nextStatus, total: po.total };
}

export function approvePo(companyId: string, poId: string, userId: string, note?: string) {
  return decidePo(companyId, poId, 'APPROVE', userId, note);
}

export function rejectPo(companyId: string, poId: string, userId: string, note?: string) {
  return decidePo(companyId, poId, 'REJECT', userId, note);
}

export function listPos(companyId: string) {
  return repo.listPos(companyId);
}

export async function getPo(companyId: string, id: string) {
  const po = await repo.findPo(companyId, id);
  if (!po) throw new NotFoundError('Purchase Order', id);
  const lines = await repo.listPoLines(id);
  return { ...po, lines };
}
