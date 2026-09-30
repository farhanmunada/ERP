import { randomUUID } from 'node:crypto';

import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import { NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { JOURNAL_SOURCE, postJournalTx, resolveAccountId } from '../finance/index.ts';
import { computeAmounts } from './amounts.ts';
import { matchThreeWay } from './matching.ts';
import type { MatchInputLine } from './matching.ts';
import * as repo from './procurement.repository.ts';
import {
  AP_ACCOUNT_CODE,
  BILL_STATUS,
  GRN_ACCRUAL_ACCOUNT_CODE,
  OUTBOX_EVENT_TYPES,
  PPN_INPUT_ACCOUNT_CODE,
} from './procurement.types.ts';
import type { MatchResult } from './procurement.types.ts';
import { requireVendor } from './vendor.service.ts';

export interface BillLineInput {
  readonly poLineId?: string | null;
  readonly itemId: string;
  readonly qty: string;
  readonly unitPrice: string;
}

export interface CreateBillInput {
  readonly companyId: string;
  readonly billDate: string;
  readonly vendorId: string;
  readonly poId?: string | null;
  readonly tax: string;
  readonly lines: readonly BillLineInput[];
  readonly userId: string;
}

export interface BillResult {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
  readonly total: string;
  readonly match: MatchResult | null;
}

const DEFAULT_TOLERANCE = { qtyPct: '2.00', pricePct: '2.00' } as const;

async function toleranceFor(companyId: string) {
  const settings = await repo.findSettings(companyId);
  return settings
    ? { qtyPct: settings.qtyTolerancePct, pricePct: settings.priceTolerancePct }
    : DEFAULT_TOLERANCE;
}

// Builds the 3-way match input: PO qty/price vs GRN received vs Bill (PRD Story 3.3).
async function buildMatchInput(tx: Tx, poId: string, lines: readonly BillLineInput[]): Promise<MatchInputLine[]> {
  const poLines = await repo.listPoLinesForUpdate(tx, poId);
  const byId = new Map(poLines.map((line) => [line.id, line]));

  const receivedRows = await repo.sumReceivedByPoLine(tx, poId);
  const receivedByPoLine = new Map<string, bigint>();
  for (const row of receivedRows) {
    const current = receivedByPoLine.get(row.poLineId) ?? 0n;
    receivedByPoLine.set(row.poLineId, current + toQtyUnits(row.qtyReceived));
  }

  return lines.map((line) => {
    const poLine = line.poLineId ? byId.get(line.poLineId) : undefined;
    const qtyGrnUnits = line.poLineId ? (receivedByPoLine.get(line.poLineId) ?? 0n) : 0n;
    return {
      poLineId: line.poLineId ?? '',
      itemId: line.itemId,
      qtyPo: poLine?.qty ?? '0.0000',
      qtyGrn: fromQtyUnits(qtyGrnUnits),
      qtyBill: line.qty,
      pricePo: poLine?.unitPrice ?? '0.00',
      priceBill: line.unitPrice,
    };
  });
}

// Creates a Vendor Bill and computes the 3-way match. Exception bills must be overridden before posting.
export async function createBill(input: CreateBillInput): Promise<BillResult> {
  await requireVendor(input.companyId, input.vendorId);
  const amounts = computeAmounts(input.lines, input.tax);
  const period = input.billDate.slice(0, 4);

  return runInTransaction(async (tx) => {
    const id = randomUUID();
    const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'BILL', prefix: 'BILL', period });

    let match: MatchResult | null = null;
    if (input.poId) {
      const tolerance = await toleranceFor(input.companyId);
      const matchInput = await buildMatchInput(tx, input.poId, input.lines);
      match = matchThreeWay(matchInput, tolerance);
    }

    const status = match?.status === 'EXCEPTION' ? BILL_STATUS.MATCH_EXCEPTION : BILL_STATUS.MATCHED;

    await repo.insertBill(tx, {
      id,
      companyId: input.companyId,
      docNumber,
      billDate: input.billDate,
      vendorId: input.vendorId,
      poId: input.poId ?? null,
      status,
      subtotal: amounts.subtotal,
      tax: amounts.tax,
      total: amounts.total,
      matchResult: match,
      createdBy: input.userId,
    });
    await repo.insertBillLines(
      tx,
      input.lines.map((line) => ({
        id: randomUUID(),
        billId: id,
        poLineId: line.poLineId ?? null,
        itemId: line.itemId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: fromMinorUnits(toQtyUnits(line.qty) * toMinorUnits(line.unitPrice) / 10_000n),
      })),
    );

    await writeOutboxEvent(tx, {
      eventType: 'procurement.bill_created',
      aggregateType: 'vendor_bill',
      aggregateId: id,
      payload: { docNumber, status, total: amounts.total },
    });
    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: 'BILL_CREATED',
      entityType: 'vendor_bill',
      entityId: id,
      stateAfter: { docNumber, status, matchStatus: match?.status ?? 'N/A' },
    });

    return { id, docNumber, status, total: amounts.total, match };
  });
}

// Overrides a MATCH_EXCEPTION with a reason; the reason is recorded in the audit trail (PRD 3.3.3).
export async function overrideBill(
  companyId: string,
  billId: string,
  userId: string,
  reason: string,
): Promise<BillResult> {
  return runInTransaction(async (tx) => {
    const bill = await repo.findBillForUpdate(tx, companyId, billId);
    if (!bill) throw new NotFoundError('Vendor Bill', billId);
    if (bill.status !== BILL_STATUS.MATCH_EXCEPTION) {
      throw new UnprocessableError(`Bill berstatus ${bill.status} tidak memerlukan override`);
    }

    await repo.updateBill(tx, billId, { status: BILL_STATUS.MATCHED, overrideReason: reason, overriddenBy: userId });
    await writeAuditLog(tx, {
      companyId,
      userId,
      action: 'BILL_OVERRIDE',
      entityType: 'vendor_bill',
      entityId: billId,
      stateBefore: { status: BILL_STATUS.MATCH_EXCEPTION },
      stateAfter: { status: BILL_STATUS.MATCHED, reason },
    });

    return { id: billId, docNumber: bill.docNumber, status: BILL_STATUS.MATCHED, total: bill.total, match: bill.matchResult as MatchResult | null };
  });
}

// Posts a matched bill: Debit GRN Accrual + Debit PPN Masukan / Credit AP (PRD 3.3.3).
export async function postBill(companyId: string, billId: string, userId: string): Promise<BillResult> {
  const bill = await repo.findBill(companyId, billId);
  if (!bill) throw new NotFoundError('Vendor Bill', billId);
  if (bill.status !== BILL_STATUS.MATCHED) {
    throw new UnprocessableError(`Bill berstatus ${bill.status} belum dapat diposting`);
  }

  return runInTransaction(async (tx) => {
    const locked = await repo.findBillForUpdate(tx, companyId, billId);
    if (!locked) throw new NotFoundError('Vendor Bill', billId);
    if (locked.status !== BILL_STATUS.MATCHED) {
      throw new UnprocessableError(`Bill berstatus ${locked.status} belum dapat diposting`);
    }

    const journalEntryId = await postBillJournal(tx, companyId, billId, locked.docNumber, locked.billDate, locked.subtotal, locked.tax, locked.total, userId);
    await repo.updateBill(tx, billId, { status: BILL_STATUS.POSTED, journalEntryId });

    if (locked.poId) {
      await applyBilled(tx, locked.poId);
    }

    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.BILL_POSTED,
      aggregateType: 'vendor_bill',
      aggregateId: billId,
      payload: { docNumber: locked.docNumber, journalEntryId, total: locked.total },
    });
    await writeAuditLog(tx, {
      companyId,
      userId,
      action: 'BILL_POSTED',
      entityType: 'vendor_bill',
      entityId: billId,
      stateAfter: { status: BILL_STATUS.POSTED, journalEntryId },
    });

    return { id: billId, docNumber: locked.docNumber, status: BILL_STATUS.POSTED, total: locked.total, match: locked.matchResult as MatchResult | null };
  });
}

async function postBillJournal(
  tx: Tx,
  companyId: string,
  billId: string,
  docNumber: string,
  billDate: string,
  subtotal: string,
  tax: string,
  total: string,
  userId: string,
): Promise<string> {
  const accrualAccountId = await resolveAccountId(companyId, GRN_ACCRUAL_ACCOUNT_CODE);
  const apAccountId = await resolveAccountId(companyId, AP_ACCOUNT_CODE);

  const lines = [{ accountId: accrualAccountId, debit: subtotal, credit: '0.00' }];
  if (toMinorUnits(tax) > 0n) {
    const ppnAccountId = await resolveAccountId(companyId, PPN_INPUT_ACCOUNT_CODE);
    lines.push({ accountId: ppnAccountId, debit: tax, credit: '0.00' });
  }
  lines.push({ accountId: apAccountId, debit: '0.00', credit: total });

  const journal = await postJournalTx(
    tx,
    {
      companyId,
      entryDate: billDate,
      description: `Tagihan vendor ${docNumber}`,
      sourceType: JOURNAL_SOURCE.PROCUREMENT,
      sourceId: billId,
      lines,
    },
    userId,
  );
  return journal.id;
}

// Increments billed_qty on PO lines from the bill's lines.
async function applyBilled(tx: Tx, poId: string): Promise<void> {
  const poLines = await repo.listPoLinesForUpdate(tx, poId);
  const byId = new Map(poLines.map((line) => [line.id, line]));
  const billLines = await repo.sumBilledByPoLine(tx, poId);
  for (const billLine of billLines) {
    if (!billLine.poLineId) continue;
    const poLine = byId.get(billLine.poLineId);
    if (!poLine) continue;
    const newBilled = fromQtyUnits(toQtyUnits(poLine.billedQty) + toQtyUnits(billLine.qty));
    await repo.updatePoLine(tx, billLine.poLineId, { billedQty: newBilled });
  }
}

export function listBills(companyId: string) {
  return repo.listBills(companyId);
}

export async function getBill(companyId: string, id: string) {
  const bill = await repo.findBill(companyId, id);
  if (!bill) throw new NotFoundError('Vendor Bill', id);
  const lines = await repo.listBillLines(id);
  return { ...bill, lines };
}
