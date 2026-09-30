import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { db, pool } from '../core/database/client.ts';
import { approvalRequests, approvalRules, branches, companies, warehouses } from '../db/schema/iam.schema.ts';
import { items } from '../db/schema/inventory.schema.ts';
import { createAccount, listAccounts } from '../modules/finance/coa.service.ts';
import { postJournal, reverseJournal } from '../modules/finance/journal.service.ts';
import { trialBalance } from '../modules/finance/reports.service.ts';
import { JOURNAL_SOURCE } from '../modules/finance/finance.types.ts';
import { createRule as createApprovalRule, decide, submitForApproval } from '../modules/approval/approval.service.ts';
import { createItem } from '../modules/inventory/item.service.ts';
import { listStock, stockIn, stockOut } from '../modules/inventory/stock.service.ts';
import { completeTransfer, createTransfer } from '../modules/inventory/transfer.service.ts';
import { createOpname } from '../modules/inventory/opname.service.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`SMOKE FAIL: ${message}`);
  console.log(`  ok: ${message}`);
}

const companyId = randomUUID();
const userId = randomUUID();

try {
  console.log('[1] Setup company');
  await db.insert(companies).values({ id: companyId, code: `SMOKE-${companyId.slice(0, 6)}`, name: 'Smoke Test Co' });

  console.log('[2] Create COA');
  const cashId = await createAccount({ companyId, code: '1100', name: 'Cash', type: 'ASSET' });
  const revenueId = await createAccount({ companyId, code: '4100', name: 'Sales Revenue', type: 'REVENUE' });
  await createAccount({ companyId, code: '1300', name: 'Persediaan', type: 'ASSET' });
  await createAccount({ companyId, code: '5200', name: 'Beban Operasional', type: 'EXPENSE' });
  const accounts = await listAccounts(companyId);
  assert(accounts.length === 4, 'COA tersimpan 4 akun');

  console.log('[3] Post journal (balanced)');
  const journal = await postJournal(
    {
      companyId,
      entryDate: '2026-09-30',
      description: 'Penjualan tunai',
      sourceType: JOURNAL_SOURCE.MANUAL,
      lines: [
        { accountId: cashId, debit: '3000000.00', credit: '0.00' },
        { accountId: revenueId, debit: '0.00', credit: '3000000.00' },
      ],
    },
    userId,
  );
  assert(journal.docNumber === 'JE/2026/00001', `doc number ter-generate: ${journal.docNumber}`);

  console.log('[4] Trial balance mencerminkan jurnal');
  const tb = await trialBalance(companyId);
  assert(tb.balanced, 'trial balance seimbang');
  assert(tb.totalDebit === '3000000.00', `total debit = ${tb.totalDebit}`);

  console.log('[5] Reversal entry');
  const reversal = await reverseJournal(companyId, journal.id, userId);
  assert(reversal.id !== journal.id, 'reversal adalah entry baru (append-only)');
  const tbAfter = await trialBalance(companyId);
  assert(tbAfter.totalDebit === '6000000.00', `setelah reversal total debit = ${tbAfter.totalDebit}`);
  assert(tbAfter.balanced, 'trial balance tetap seimbang setelah reversal');

  console.log('[6] Jurnal tidak balance ditolak');
  let rejected = false;
  try {
    await postJournal(
      {
        companyId,
        entryDate: '2026-09-30',
        description: 'Rusak',
        sourceType: JOURNAL_SOURCE.MANUAL,
        lines: [
          { accountId: cashId, debit: '1000.00', credit: '0.00' },
          { accountId: revenueId, debit: '0.00', credit: '900.00' },
        ],
      },
      userId,
    );
  } catch {
    rejected = true;
  }
  assert(rejected, 'jurnal tidak balance ditolak');

  console.log('[7] Approval matrix: 2-tier PO');
  await createApprovalRule({
    companyId,
    documentType: 'PURCHASE_ORDER',
    minAmount: '100000000.01',
    maxAmount: null,
    levels: [
      { level: 1, roleCode: 'MANAGER' },
      { level: 2, roleCode: 'DIRECTOR' },
    ],
  });
  const docId = randomUUID();
  const requestId = await submitForApproval({
    companyId,
    documentType: 'PURCHASE_ORDER',
    documentId: docId,
    amount: '150000000.00',
    userId,
  });
  assert(requestId.length > 0, 'approval request terbuat (level 1)');

  console.log('[8] Approve level 1 → level 2 → APPROVED');
  const level1 = await decide({ companyId, requestId, action: 'APPROVE', userId });
  assert(level1.status === 'PENDING' && level1.currentLevel === 2, `setelah level 1: ${level1.status}/L${level1.currentLevel}`);
  const level2 = await decide({ companyId, requestId, action: 'APPROVE', userId });
  assert(level2.status === 'APPROVED', `setelah level 2: ${level2.status}`);

  console.log('[9] Inventory setup: branch + 2 warehouse + 2 item');
  const branchId = randomUUID();
  const whA = randomUUID();
  const whB = randomUUID();
  await db.insert(branches).values({ id: branchId, companyId, code: `BR-${companyId.slice(0, 6)}`, name: 'Cabang Smoke' });
  await db.insert(warehouses).values([
    { id: whA, companyId, branchId, code: 'WH-A', name: 'Gudang A' },
    { id: whB, companyId, branchId, code: 'WH-B', name: 'Gudang B' },
  ]);
  const itemMa = await createItem({
    companyId,
    code: 'SMK-MA',
    name: 'Item Moving Average',
    uom: 'PCS',
    costingMethod: 'MOVING_AVERAGE',
    trackBatch: false,
    trackSerial: false,
    reorderPoint: '0',
  });
  const itemFifo = await createItem({
    companyId,
    code: 'SMK-FIFO',
    name: 'Item FIFO',
    uom: 'PCS',
    costingMethod: 'FIFO',
    trackBatch: false,
    trackSerial: false,
    reorderPoint: '0',
  });
  assert(itemMa.length > 0 && itemFifo.length > 0, 'item master terbuat');

  console.log('[10] Stock In (moving average) 100 @ 10.000 lalu 100 @ 12.000 → avg 11.000');
  await stockIn({ companyId, itemId: itemMa, warehouseId: whA, quantity: '100', unitCost: '10000', userId });
  const in2 = await stockIn({ companyId, itemId: itemMa, warehouseId: whA, quantity: '100', unitCost: '12000', userId });
  assert(in2.onHand === '200.0000', `on-hand = ${in2.onHand}`);
  const stockMa = await listStock(companyId, { itemId: itemMa, warehouseId: whA });
  assert(stockMa[0]?.avgCost === '11000.00', `avg cost = ${stockMa[0]?.avgCost}`);

  console.log('[11] Stock Out melebihi stok ditolak (422)');
  let overRejected = false;
  try {
    await stockOut({ companyId, itemId: itemMa, warehouseId: whA, quantity: '999', userId });
  } catch {
    overRejected = true;
  }
  assert(overRejected, 'stok tidak cukup ditolak');

  console.log('[12] FIFO: 100@10.000 + 100@12.000, keluar 150 → HPP 1.600.000');
  await stockIn({ companyId, itemId: itemFifo, warehouseId: whA, quantity: '100', unitCost: '10000', userId });
  await stockIn({ companyId, itemId: itemFifo, warehouseId: whA, quantity: '100', unitCost: '12000', userId });
  const fifoOut = await stockOut({ companyId, itemId: itemFifo, warehouseId: whA, quantity: '150', userId });
  assert(fifoOut.totalCost === '1600000.00', `HPP FIFO = ${fifoOut.totalCost}`);

  console.log('[13] Transfer 30 unit A → B (in-transit lalu complete)');
  const transfer = await createTransfer({ companyId, itemId: itemMa, fromWarehouseId: whA, toWarehouseId: whB, quantity: '30', userId });
  const inTransit = await listStock(companyId, { itemId: itemMa, warehouseId: whA });
  assert(inTransit[0]?.available === '170.0000', `available saat in-transit = ${inTransit[0]?.available}`);
  await completeTransfer(companyId, transfer.id, userId);
  const [afterA, afterB] = await Promise.all([
    listStock(companyId, { itemId: itemMa, warehouseId: whA }),
    listStock(companyId, { itemId: itemMa, warehouseId: whB }),
  ]);
  assert(afterA[0]?.onHand === '170.0000', `Gudang A = ${afterA[0]?.onHand}`);
  assert(afterB[0]?.onHand === '30.0000', `Gudang B = ${afterB[0]?.onHand}`);

  console.log('[14] Opname: fisik 165 (sistem 170) → jurnal selisih');
  const opname = await createOpname({
    companyId,
    warehouseId: whA,
    opnameDate: '2026-09-30',
    lines: [{ itemId: itemMa, physicalQty: '165' }],
    userId,
  });
  assert(opname.journalEntryId !== null, 'jurnal opname ter-generate');
  const tbAfterOpname = await trialBalance(companyId);
  assert(tbAfterOpname.balanced, 'trial balance tetap seimbang setelah opname');

  console.log('\nSMOKE TEST TIER 2: LULUS');
} finally {
  await db.delete(approvalRequests).where(eq(approvalRequests.companyId, companyId));
  await db.delete(approvalRules).where(eq(approvalRules.companyId, companyId));
  await db.delete(items).where(eq(items.companyId, companyId));
  await db.delete(warehouses).where(eq(warehouses.companyId, companyId));
  await db.delete(branches).where(eq(branches.companyId, companyId));
  await db.delete(companies).where(eq(companies.id, companyId));
  await pool.end();
}
