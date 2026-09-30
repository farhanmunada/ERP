import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { db, pool } from '../core/database/client.ts';
import { approvalRequests, approvalRules, branches, companies, warehouses } from '../db/schema/iam.schema.ts';
import { items } from '../db/schema/inventory.schema.ts';
import {
  goodsReceipts,
  procurementSettings,
  purchaseOrders,
  purchaseRequisitions,
  vendorBills,
  vendors,
} from '../db/schema/procurement.schema.ts';
import { createAccount, listAccounts } from '../modules/finance/coa.service.ts';
import { postJournal, reverseJournal } from '../modules/finance/journal.service.ts';
import { trialBalance } from '../modules/finance/reports.service.ts';
import { JOURNAL_SOURCE } from '../modules/finance/finance.types.ts';
import { createRule as createApprovalRule, decide, submitForApproval } from '../modules/approval/approval.service.ts';
import { createItem } from '../modules/inventory/item.service.ts';
import { listStock, stockIn, stockOut } from '../modules/inventory/stock.service.ts';
import { completeTransfer, createTransfer } from '../modules/inventory/transfer.service.ts';
import { createOpname } from '../modules/inventory/opname.service.ts';
import { createVendor } from '../modules/procurement/vendor.service.ts';
import { approvePr, createPr } from '../modules/procurement/pr.service.ts';
import { approvePo, convertPrToPo, createPo, getPo, submitPo } from '../modules/procurement/po.service.ts';
import { createGrn } from '../modules/procurement/grn.service.ts';
import { createBill, overrideBill, postBill } from '../modules/procurement/bill.service.ts';

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
  await createAccount({ companyId, code: '2130', name: 'GRN Accrual', type: 'LIABILITY' });
  await createAccount({ companyId, code: '2100', name: 'Utang Usaha', type: 'LIABILITY' });
  await createAccount({ companyId, code: '2120', name: 'PPN Masukan', type: 'ASSET' });
  const accounts = await listAccounts(companyId);
  assert(accounts.length === 7, 'COA tersimpan 7 akun');

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

  console.log('[15] Procurement: vendor + PR → PO (konversi)');
  const vendorId = await createVendor({
    companyId,
    code: 'VND-SMK',
    name: 'Supplier Smoke',
    paymentTermDays: 30,
  });
  const pr = await createPr({
    companyId,
    prDate: '2026-10-01',
    lines: [{ itemId: itemMa, qty: '100' }],
    userId,
  });
  assert(pr.status === 'DRAFT', `PR status = ${pr.status}`);
  await approvePr(companyId, pr.id, userId);
  const poFromPr = await convertPrToPo({
    companyId,
    prId: pr.id,
    vendorId,
    warehouseId: whA,
    poDate: '2026-10-01',
    tax: '0',
    lines: [{ itemId: itemMa, qty: '100', unitPrice: '10000' }],
    userId,
  });
  assert(poFromPr.status === 'DRAFT', `PO dari PR status = ${poFromPr.status}`);
  assert(poFromPr.total === '1000000.00', `total PO = ${poFromPr.total}`);

  console.log('[16] PO submit (tanpa rule) → APPROVED otomatis');
  const poApproved = await submitPo(companyId, poFromPr.id, userId);
  assert(poApproved.status === 'APPROVED', `PO status = ${poApproved.status}`);

  console.log('[17] GRN parsial 60 → stok naik + jurnal, sisa PO 40');
  const poDetail = await getPo(companyId, poFromPr.id);
  const poLine = poDetail.lines[0];
  if (!poLine) throw new Error('SMOKE FAIL: PO line tidak ada');
  const grn1 = await createGrn({
    companyId,
    poId: poFromPr.id,
    warehouseId: whA,
    grnDate: '2026-10-02',
    lines: [{ poLineId: poLine.id, qtyReceived: '60' }],
    userId,
  });
  assert(grn1.journalEntryId !== null, 'jurnal GRN ter-generate');
  assert(grn1.receivedValue === '600000.00', `nilai GRN = ${grn1.receivedValue}`);
  const poAfterGrn1 = await getPo(companyId, poFromPr.id);
  assert(poAfterGrn1.status === 'PARTIALLY_RECEIVED', `PO status = ${poAfterGrn1.status}`);
  assert(poAfterGrn1.lines[0]?.receivedQty === '60.0000', `received_qty = ${poAfterGrn1.lines[0]?.receivedQty}`);

  console.log('[18] GRN kedua 40 → PO RECEIVED');
  const grn2 = await createGrn({
    companyId,
    poId: poFromPr.id,
    warehouseId: whA,
    grnDate: '2026-10-03',
    lines: [{ poLineId: poLine.id, qtyReceived: '40' }],
    userId,
  });
  assert(grn2.receivedValue === '400000.00', `nilai GRN kedua = ${grn2.receivedValue}`);
  const poAfterGrn2 = await getPo(companyId, poFromPr.id);
  assert(poAfterGrn2.status === 'RECEIVED', `PO status = ${poAfterGrn2.status}`);

  console.log('[19] Vendor Bill 100@10.000 → 3-way match PASS + post jurnal');
  const bill = await createBill({
    companyId,
    billDate: '2026-10-04',
    vendorId,
    poId: poFromPr.id,
    tax: '0',
    lines: [{ poLineId: poLine.id, itemId: itemMa, qty: '100', unitPrice: '10000' }],
    userId,
  });
  assert(bill.match?.status === 'PASS', `match status = ${bill.match?.status}`);
  assert(bill.status === 'MATCHED', `bill status = ${bill.status}`);
  const postedBill = await postBill(companyId, bill.id, userId);
  assert(postedBill.status === 'POSTED', `bill posted status = ${postedBill.status}`);
  const tbAfterBill = await trialBalance(companyId);
  assert(tbAfterBill.balanced, 'trial balance seimbang setelah bill posted');

  console.log('[20] Bill exception 5% > 2% → MATCH_EXCEPTION lalu override');
  const pr2 = await createPr({ companyId, prDate: '2026-10-01', lines: [{ itemId: itemFifo, qty: '10' }], userId });
  await approvePr(companyId, pr2.id, userId);
  const po2 = await convertPrToPo({
    companyId,
    prId: pr2.id,
    vendorId,
    warehouseId: whA,
    poDate: '2026-10-01',
    tax: '0',
    lines: [{ itemId: itemFifo, qty: '10', unitPrice: '10000' }],
    userId,
  });
  await submitPo(companyId, po2.id, userId);
  const po2Detail = await getPo(companyId, po2.id);
  const po2Line = po2Detail.lines[0];
  if (!po2Line) throw new Error('SMOKE FAIL: PO2 line tidak ada');
  await createGrn({
    companyId,
    poId: po2.id,
    warehouseId: whA,
    grnDate: '2026-10-02',
    lines: [{ poLineId: po2Line.id, qtyReceived: '10' }],
    userId,
  });
  const exceptionBill = await createBill({
    companyId,
    billDate: '2026-10-04',
    vendorId,
    poId: po2.id,
    tax: '0',
    lines: [{ poLineId: po2Line.id, itemId: itemFifo, qty: '10', unitPrice: '10500' }],
    userId,
  });
  assert(exceptionBill.match?.status === 'EXCEPTION', `match = ${exceptionBill.match?.status}`);
  assert(exceptionBill.status === 'MATCH_EXCEPTION', `bill status = ${exceptionBill.status}`);
  let postBlocked = false;
  try {
    await postBill(companyId, exceptionBill.id, userId);
  } catch {
    postBlocked = true;
  }
  assert(postBlocked, 'bill exception diblokir dari posting');
  const overridden = await overrideBill(companyId, exceptionBill.id, userId, 'Harga disetujui ulang oleh manager');
  assert(overridden.status === 'MATCHED', `setelah override status = ${overridden.status}`);
  const postedException = await postBill(companyId, exceptionBill.id, userId);
  assert(postedException.status === 'POSTED', 'bill exception dapat diposting setelah override');

  console.log('[21] PPN pada bill → jurnal Debit PPN Masukan');
  const billTaxed = await createBill({
    companyId,
    billDate: '2026-10-04',
    vendorId,
    poId: null,
    tax: '110000.00',
    lines: [{ itemId: itemMa, qty: '100', unitPrice: '10000' }],
    userId,
  });
  assert(billTaxed.total === '1110000.00', `total dengan PPN = ${billTaxed.total}`);
  await postBill(companyId, billTaxed.id, userId);
  const tbFinal = await trialBalance(companyId);
  assert(tbFinal.balanced, 'trial balance seimbang setelah bill PPN');

  console.log('\nSMOKE TEST TIER 2: LULUS');
} finally {
  // Child tables have no company_id; remove them via subquery before their parents.
  await pool.query(
    'DELETE bl FROM vendor_bill_lines bl JOIN vendor_bills b ON b.id = bl.bill_id WHERE b.company_id = ?',
    [companyId],
  );
  await pool.query(
    'DELETE gl FROM goods_receipt_lines gl JOIN goods_receipts g ON g.id = gl.grn_id WHERE g.company_id = ?',
    [companyId],
  );
  await pool.query(
    'DELETE pl FROM purchase_order_lines pl JOIN purchase_orders p ON p.id = pl.po_id WHERE p.company_id = ?',
    [companyId],
  );
  await pool.query(
    'DELETE rl FROM purchase_requisition_lines rl JOIN purchase_requisitions r ON r.id = rl.pr_id WHERE r.company_id = ?',
    [companyId],
  );
  await db.delete(vendorBills).where(eq(vendorBills.companyId, companyId));
  await db.delete(goodsReceipts).where(eq(goodsReceipts.companyId, companyId));
  await db.delete(purchaseOrders).where(eq(purchaseOrders.companyId, companyId));
  await db.delete(purchaseRequisitions).where(eq(purchaseRequisitions.companyId, companyId));
  await db.delete(procurementSettings).where(eq(procurementSettings.companyId, companyId));
  await db.delete(vendors).where(eq(vendors.companyId, companyId));
  await db.delete(approvalRequests).where(eq(approvalRequests.companyId, companyId));
  await db.delete(approvalRules).where(eq(approvalRules.companyId, companyId));
  await db.delete(items).where(eq(items.companyId, companyId));
  await db.delete(warehouses).where(eq(warehouses.companyId, companyId));
  await db.delete(branches).where(eq(branches.companyId, companyId));
  await db.delete(companies).where(eq(companies.id, companyId));
  await pool.end();
}
