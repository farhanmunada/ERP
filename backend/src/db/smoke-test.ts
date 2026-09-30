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
import { customers, creditNotes, customerInvoices, deliveryOrders, quotations, salesOrders } from '../db/schema/sales.schema.ts';
import { createCustomer } from '../modules/sales/customer.service.ts';
import { acceptQuotation, createQuotation } from '../modules/sales/quotation.service.ts';
import { confirmSo, convertQuotationToSo, createSo, getSo } from '../modules/sales/so.service.ts';
import { createDelivery } from '../modules/sales/do.service.ts';
import { createInvoice, getInvoice, voidInvoice } from '../modules/sales/invoice.service.ts';
import { createCreditNote } from '../modules/sales/credit-note.service.ts';

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
  await createAccount({ companyId, code: '1200', name: 'Piutang Usaha', type: 'ASSET' });
  await createAccount({ companyId, code: '2110', name: 'PPN Keluaran', type: 'LIABILITY' });
  await createAccount({ companyId, code: '5100', name: 'HPP', type: 'EXPENSE' });
  const accounts = await listAccounts(companyId);
  assert(accounts.length === 10, 'COA tersimpan 10 akun');

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

  console.log('[22] Sales: customer + Quotation 200 @ 15.000 → accept → convert ke SO');
  const customerId = await createCustomer({
    companyId,
    code: 'CUST-SMK',
    name: 'Toko Smoke',
    creditLimit: '5000000.00',
    paymentTermDays: 30,
  });
  const quotation = await createQuotation({
    companyId,
    quoteDate: '2026-10-05',
    customerId,
    tax: '0',
    lines: [{ itemId: itemMa, qty: '200', unitPrice: '15000' }],
    userId,
  });
  assert(quotation.total === '3000000.00', `total quotation = ${quotation.total}`);
  await acceptQuotation(companyId, quotation.id, userId);
  const soFromQuote = await convertQuotationToSo({ companyId, quotationId: quotation.id, warehouseId: whA, soDate: '2026-10-05', userId });
  assert(soFromQuote.status === 'DRAFT', `SO dari quotation status = ${soFromQuote.status}`);
  assert(soFromQuote.total === '3000000.00', `total SO = ${soFromQuote.total}`);

  console.log('[23] SO confirm: credit check lolos + soft reserve (reserved 200, on-hand tetap)');
  const stockBeforeReserve = await listStock(companyId, { itemId: itemMa, warehouseId: whA });
  const onHandBefore = stockBeforeReserve[0]?.onHand ?? '0.0000';
  const confirmed = await confirmSo(companyId, soFromQuote.id, userId);
  assert(confirmed.status === 'CONFIRMED', `SO status = ${confirmed.status}`);
  const stockReserved = await listStock(companyId, { itemId: itemMa, warehouseId: whA });
  assert(stockReserved[0]?.reserved === '200.0000', `reserved = ${stockReserved[0]?.reserved}`);
  assert(stockReserved[0]?.onHand === onHandBefore, `on-hand tidak berubah saat reserve = ${stockReserved[0]?.onHand}`);

  console.log('[24] Credit check: SO melebihi limit ditolak (422)');
  const bigSo = await createSo({
    companyId,
    soDate: '2026-10-05',
    customerId,
    warehouseId: whA,
    tax: '0',
    lines: [{ itemId: itemMa, qty: '400', unitPrice: '15000' }],
    userId,
  });
  let creditRejected = false;
  try {
    await confirmSo(companyId, bigSo.id, userId);
  } catch (error) {
    creditRejected = error instanceof Error && error.message.includes('credit limit');
  }
  assert(creditRejected, 'SO melebihi credit limit ditolak');

  console.log('[25] Delivery Order 200 → on-hand turun, reserved kembali 0');
  const delivery = await createDelivery({
    companyId,
    soId: soFromQuote.id,
    doDate: '2026-10-06',
    lines: [{ soLineId: (await getSo(companyId, soFromQuote.id)).lines[0]!.id, qtyDelivered: '200' }],
    userId,
  });
  assert(delivery.status === 'POSTED', `DO status = ${delivery.status}`);
  const stockAfterDo = await listStock(companyId, { itemId: itemMa, warehouseId: whA });
  assert(stockAfterDo[0]?.reserved === '0.0000', `reserved setelah DO = ${stockAfterDo[0]?.reserved}`);

  console.log('[26] Customer Invoice → jurnal AR/Sales/COGS/Inventory, TB seimbang');
  const invoice = await createInvoice({ companyId, doId: delivery.id, invoiceDate: '2026-10-06', tax: '0', userId });
  assert(invoice.total === '3000000.00', `total invoice = ${invoice.total}`);
  assert(Number(invoice.cogs) > 0, `COGS terhitung = ${invoice.cogs}`);
  const tbAfterInvoice = await trialBalance(companyId);
  assert(tbAfterInvoice.balanced, 'trial balance seimbang setelah invoice');

  console.log('[27] Credit note parsial 50 unit → jurnal balik revenue & COGS');
  const invoiceLines = (await getInvoice(companyId, invoice.id)).lines;
  const creditNote = await createCreditNote({
    companyId,
    invoiceId: invoice.id,
    cnDate: '2026-10-07',
    lines: [{ invoiceLineId: invoiceLines[0]!.id, qty: '50' }],
    userId,
  });
  assert(creditNote.total === '750000.00', `total credit note = ${creditNote.total}`);
  const tbAfterCn = await trialBalance(companyId);
  assert(tbAfterCn.balanced, 'trial balance seimbang setelah credit note');

  console.log('[28] Void invoice → jurnal reversal (jurnal asal tidak diubah)');
  const voided = await voidInvoice(companyId, invoice.id, userId);
  assert(voided.status === 'VOID', `invoice status = ${voided.status}`);
  const tbAfterVoid = await trialBalance(companyId);
  assert(tbAfterVoid.balanced, 'trial balance seimbang setelah void');

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
  // Sales child tables (no company_id) via subquery before their parents.
  await pool.query(
    'DELETE cnl FROM credit_note_lines cnl JOIN credit_notes cn ON cn.id = cnl.cn_id WHERE cn.company_id = ?',
    [companyId],
  );
  await pool.query(
    'DELETE cil FROM customer_invoice_lines cil JOIN customer_invoices ci ON ci.id = cil.invoice_id WHERE ci.company_id = ?',
    [companyId],
  );
  await pool.query(
    'DELETE dol FROM delivery_order_lines dol JOIN delivery_orders d ON d.id = dol.do_id WHERE d.company_id = ?',
    [companyId],
  );
  await pool.query(
    'DELETE sol FROM sales_order_lines sol JOIN sales_orders s ON s.id = sol.so_id WHERE s.company_id = ?',
    [companyId],
  );
  await pool.query(
    'DELETE ql FROM quotation_lines ql JOIN quotations q ON q.id = ql.quotation_id WHERE q.company_id = ?',
    [companyId],
  );
  await db.delete(creditNotes).where(eq(creditNotes.companyId, companyId));
  await db.delete(customerInvoices).where(eq(customerInvoices.companyId, companyId));
  await db.delete(deliveryOrders).where(eq(deliveryOrders.companyId, companyId));
  await db.delete(salesOrders).where(eq(salesOrders.companyId, companyId));
  await db.delete(quotations).where(eq(quotations.companyId, companyId));
  await db.delete(customers).where(eq(customers.companyId, companyId));
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
