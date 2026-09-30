import { randomUUID } from 'node:crypto';

import { buildApp } from '../app.ts';
import { pool } from '../core/database/client.ts';
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, DEFAULT_COMPANY_ID, DEFAULT_WAREHOUSE_ID } from './seed-data.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`API SMOKE FAIL: ${message}`);
  console.log(`  ok: ${message}`);
}

const app = buildApp();

try {
  console.log('[1] Login admin (seed)');
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'x-company-id': DEFAULT_COMPANY_ID },
    payload: { email: DEFAULT_ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD },
  });
  assert(login.statusCode === 200, `login 200 (dapat ${login.statusCode})`);
  const accessToken = login.json().data.accessToken as string;
  assert(typeof accessToken === 'string' && accessToken.length > 20, 'access token diterima');

  const authHeaders = { authorization: `Bearer ${accessToken}` };

  console.log('[2] GET /coa tanpa token → 401');
  const noAuth = await app.inject({ method: 'GET', url: '/api/v1/coa' });
  assert(noAuth.statusCode === 401, `tanpa token ditolak (dapat ${noAuth.statusCode})`);

  console.log('[3] GET /coa dengan token → daftar akun seed');
  const coa = await app.inject({ method: 'GET', url: '/api/v1/coa', headers: authHeaders });
  assert(coa.statusCode === 200, `coa 200 (dapat ${coa.statusCode})`);
  const coaData = coa.json().data as unknown[];
  assert(coaData.length >= 10, `COA seed ter-load (${coaData.length} akun)`);

  console.log('[4] POST /finance/journals → 201');
  const cash = coaData.find((a) => (a as { code: string }).code === '1100') as { id: string };
  const revenue = coaData.find((a) => (a as { code: string }).code === '4100') as { id: string };
  const journal = await app.inject({
    method: 'POST',
    url: '/api/v1/finance/journals',
    headers: authHeaders,
    payload: {
      entryDate: '2026-09-30',
      description: 'Penjualan tunai (API smoke)',
      lines: [
        { accountId: cash.id, debit: '500000.00', credit: '0.00' },
        { accountId: revenue.id, debit: '0.00', credit: '500000.00' },
      ],
    },
  });
  assert(journal.statusCode === 201, `jurnal dibuat (dapat ${journal.statusCode})`);

  console.log('[5] POST jurnal tidak balance → 400/422');
  const badJournal = await app.inject({
    method: 'POST',
    url: '/api/v1/finance/journals',
    headers: authHeaders,
    payload: {
      entryDate: '2026-09-30',
      description: 'Rusak',
      lines: [
        { accountId: cash.id, debit: '1000.00', credit: '0.00' },
        { accountId: revenue.id, debit: '0.00', credit: '900.00' },
      ],
    },
  });
  assert(badJournal.statusCode === 422, `jurnal tidak balance ditolak 422 (dapat ${badJournal.statusCode})`);

  console.log('[6] GET trial-balance → seimbang');
  const tb = await app.inject({ method: 'GET', url: '/api/v1/finance/reports/trial-balance', headers: authHeaders });
  assert(tb.statusCode === 200 && tb.json().data.balanced === true, 'trial balance seimbang');

  console.log('[7] GET /items → item seed ter-load');
  const itemsRes = await app.inject({ method: 'GET', url: '/api/v1/items', headers: authHeaders });
  assert(itemsRes.statusCode === 200, `items 200 (dapat ${itemsRes.statusCode})`);
  const itemList = itemsRes.json().data as { id: string; code: string }[];
  assert(itemList.length >= 4, `item seed ter-load (${itemList.length})`);
  const kopi = itemList.find((item) => item.code === 'ITM-001') as { id: string };

  console.log('[8] POST /inventory/stock-in tanpa Idempotency-Key → 400');
  const noKey = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/stock-in',
    headers: authHeaders,
    payload: { itemId: kopi.id, warehouseId: DEFAULT_WAREHOUSE_ID, quantity: '10', unitCost: '10000' },
  });
  assert(noKey.statusCode === 400, `tanpa idempotency key ditolak (dapat ${noKey.statusCode})`);

  console.log('[9] POST /inventory/stock-in dengan Idempotency-Key → 201, replay sama');
  const beforeRes = await app.inject({
    method: 'GET',
    url: `/api/v1/inventory/stock?itemId=${kopi.id}&warehouseId=${DEFAULT_WAREHOUSE_ID}`,
    headers: authHeaders,
  });
  const beforeOnHand = Number(beforeRes.json().data[0]?.onHand ?? '0');

  const stockKey = randomUUID();
  const stockInPayload = { itemId: kopi.id, warehouseId: DEFAULT_WAREHOUSE_ID, quantity: '10', unitCost: '10000' };
  const stockInRes = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/stock-in',
    headers: { ...authHeaders, 'idempotency-key': stockKey },
    payload: stockInPayload,
  });
  assert(stockInRes.statusCode === 201, `stock-in 201 (dapat ${stockInRes.statusCode})`);
  const firstMovement = stockInRes.json().data.movementId as string;

  const replay = await app.inject({
    method: 'POST',
    url: '/api/v1/inventory/stock-in',
    headers: { ...authHeaders, 'idempotency-key': stockKey },
    payload: stockInPayload,
  });
  assert(replay.json().data.movementId === firstMovement, 'replay mengembalikan movement yang sama (idempotent)');

  console.log('[10] GET /inventory/stock → on-hand naik 10');
  const stock = await app.inject({
    method: 'GET',
    url: `/api/v1/inventory/stock?itemId=${kopi.id}&warehouseId=${DEFAULT_WAREHOUSE_ID}`,
    headers: authHeaders,
  });
  const afterOnHand = Number(stock.json().data[0]?.onHand ?? '0');
  assert(stock.statusCode === 200 && afterOnHand === beforeOnHand + 10, `on-hand ${beforeOnHand} → ${afterOnHand}`);

  console.log('[11] GET /procurement/settings → toleransi default 2% / 2%');
  const settings = await app.inject({ method: 'GET', url: '/api/v1/procurement/settings', headers: authHeaders });
  assert(settings.statusCode === 200, `settings 200 (dapat ${settings.statusCode})`);
  assert(settings.json().data.qtyTolerancePct === '2.00', 'toleransi qty default 2.00');

  console.log('[12] POST /vendors → 201');
  const vendorRes = await app.inject({
    method: 'POST',
    url: '/api/v1/vendors',
    headers: authHeaders,
    payload: { code: `VND-API-${randomUUID().slice(0, 6)}`, name: 'Vendor API Smoke', paymentTermDays: 30 },
  });
  assert(vendorRes.statusCode === 201, `vendor dibuat (dapat ${vendorRes.statusCode})`);
  const vendorId = vendorRes.json().data.id as string;

  console.log('[13] PR → approve → convert-to-po → submit APPROVED');
  const prRes = await app.inject({
    method: 'POST',
    url: '/api/v1/procurement/pr',
    headers: authHeaders,
    payload: { prDate: '2026-10-01', lines: [{ itemId: kopi.id, qty: '100' }] },
  });
  assert(prRes.statusCode === 201, `PR dibuat (dapat ${prRes.statusCode})`);
  const prId = prRes.json().data.id as string;

  const prApprove = await app.inject({ method: 'POST', url: `/api/v1/procurement/pr/${prId}/approve`, headers: authHeaders });
  assert(prApprove.statusCode === 200, `PR disetujui (dapat ${prApprove.statusCode})`);

  const poRes = await app.inject({
    method: 'POST',
    url: `/api/v1/procurement/pr/${prId}/convert-to-po`,
    headers: authHeaders,
    payload: {
      vendorId,
      warehouseId: DEFAULT_WAREHOUSE_ID,
      poDate: '2026-10-01',
      tax: '0',
      lines: [{ itemId: kopi.id, qty: '100', unitPrice: '10000' }],
    },
  });
  assert(poRes.statusCode === 201, `PO dari PR dibuat (dapat ${poRes.statusCode})`);
  const poId = poRes.json().data.id as string;

  const poSubmit = await app.inject({ method: 'POST', url: `/api/v1/procurement/po/${poId}/submit`, headers: authHeaders });
  assert(poSubmit.statusCode === 200 && poSubmit.json().data.status === 'APPROVED', 'PO submit → APPROVED (nominal < 100jt)');

  const poDetail = await app.inject({ method: 'GET', url: `/api/v1/procurement/po/${poId}`, headers: authHeaders });
  const poLineId = poDetail.json().data.lines[0].id as string;

  console.log('[14] POST /procurement/grn tanpa Idempotency-Key → 400');
  const grnNoKey = await app.inject({
    method: 'POST',
    url: '/api/v1/procurement/grn',
    headers: authHeaders,
    payload: { poId, warehouseId: DEFAULT_WAREHOUSE_ID, grnDate: '2026-10-02', lines: [{ poLineId, qtyReceived: '100' }] },
  });
  assert(grnNoKey.statusCode === 400, `GRN tanpa key ditolak (dapat ${grnNoKey.statusCode})`);

  console.log('[15] POST /procurement/grn dengan key → 201, replay sama');
  const grnKey = randomUUID();
  const grnPayload = { poId, warehouseId: DEFAULT_WAREHOUSE_ID, grnDate: '2026-10-02', lines: [{ poLineId, qtyReceived: '100' }] };
  const grnRes = await app.inject({
    method: 'POST',
    url: '/api/v1/procurement/grn',
    headers: { ...authHeaders, 'idempotency-key': grnKey },
    payload: grnPayload,
  });
  assert(grnRes.statusCode === 201, `GRN 201 (dapat ${grnRes.statusCode})`);
  assert(grnRes.json().data.journalEntryId !== null, 'GRN men-generate jurnal');
  const grnId = grnRes.json().data.id as string;

  const grnReplay = await app.inject({
    method: 'POST',
    url: '/api/v1/procurement/grn',
    headers: { ...authHeaders, 'idempotency-key': grnKey },
    payload: grnPayload,
  });
  assert(grnReplay.json().data.id === grnId, 'replay GRN mengembalikan dokumen yang sama (idempotent)');

  console.log('[16] POST /customers → 201');
  const customerRes = await app.inject({
    method: 'POST',
    url: '/api/v1/customers',
    headers: authHeaders,
    payload: { code: `CUST-API-${randomUUID().slice(0, 6)}`, name: 'Customer API Smoke', creditLimit: '100000000.00', paymentTermDays: 30 },
  });
  assert(customerRes.statusCode === 201, `customer dibuat (dapat ${customerRes.statusCode})`);
  const customerId = customerRes.json().data.id as string;

  console.log('[17] Quotation → accept → convert-to-so');
  const quoteRes = await app.inject({
    method: 'POST',
    url: '/api/v1/sales/quotations',
    headers: authHeaders,
    payload: { quoteDate: '2026-10-05', customerId, tax: '0', lines: [{ itemId: kopi.id, qty: '50', unitPrice: '15000' }] },
  });
  assert(quoteRes.statusCode === 201, `quotation dibuat (dapat ${quoteRes.statusCode})`);
  const quoteId = quoteRes.json().data.id as string;

  const quoteAccept = await app.inject({ method: 'POST', url: `/api/v1/sales/quotations/${quoteId}/accept`, headers: authHeaders });
  assert(quoteAccept.statusCode === 200 && quoteAccept.json().data.status === 'ACCEPTED', 'quotation ACCEPTED');

  const soRes = await app.inject({
    method: 'POST',
    url: `/api/v1/sales/quotations/${quoteId}/convert-to-so`,
    headers: authHeaders,
    payload: { warehouseId: DEFAULT_WAREHOUSE_ID, soDate: '2026-10-05' },
  });
  assert(soRes.statusCode === 201, `SO dari quotation dibuat (dapat ${soRes.statusCode})`);
  const soId = soRes.json().data.id as string;

  console.log('[18] POST /sales/orders/:id/confirm → CONFIRMED + reserve');
  const confirmRes = await app.inject({ method: 'POST', url: `/api/v1/sales/orders/${soId}/confirm`, headers: authHeaders });
  assert(confirmRes.statusCode === 200 && confirmRes.json().data.status === 'CONFIRMED', 'SO dikonfirmasi (credit check lolos)');

  const soDetail = await app.inject({ method: 'GET', url: `/api/v1/sales/orders/${soId}`, headers: authHeaders });
  const soLineId = soDetail.json().data.lines[0].id as string;

  console.log('[19] POST /sales/deliveries tanpa key → 400; dengan key → 201, replay sama');
  const doPayload = { soId, doDate: '2026-10-06', lines: [{ soLineId, qtyDelivered: '50' }] };
  const doNoKey = await app.inject({ method: 'POST', url: '/api/v1/sales/deliveries', headers: authHeaders, payload: doPayload });
  assert(doNoKey.statusCode === 400, `DO tanpa key ditolak (dapat ${doNoKey.statusCode})`);

  const doKey = randomUUID();
  const doRes = await app.inject({
    method: 'POST',
    url: '/api/v1/sales/deliveries',
    headers: { ...authHeaders, 'idempotency-key': doKey },
    payload: doPayload,
  });
  assert(doRes.statusCode === 201, `DO 201 (dapat ${doRes.statusCode})`);
  const doId = doRes.json().data.id as string;

  const doReplay = await app.inject({
    method: 'POST',
    url: '/api/v1/sales/deliveries',
    headers: { ...authHeaders, 'idempotency-key': doKey },
    payload: doPayload,
  });
  assert(doReplay.json().data.id === doId, 'replay DO mengembalikan dokumen yang sama (idempotent)');

  console.log('[20] POST /sales/invoices dengan key → 201, replay sama, jurnal AR ter-generate');
  const invPayload = { doId, invoiceDate: '2026-10-06', tax: '0' };
  const invKey = randomUUID();
  const invRes = await app.inject({
    method: 'POST',
    url: '/api/v1/sales/invoices',
    headers: { ...authHeaders, 'idempotency-key': invKey },
    payload: invPayload,
  });
  assert(invRes.statusCode === 201, `invoice 201 (dapat ${invRes.statusCode})`);
  assert(invRes.json().data.total === '750000.00', `total invoice = ${invRes.json().data.total}`);
  const invoiceId = invRes.json().data.id as string;

  const invReplay = await app.inject({
    method: 'POST',
    url: '/api/v1/sales/invoices',
    headers: { ...authHeaders, 'idempotency-key': invKey },
    payload: invPayload,
  });
  assert(invReplay.json().data.id === invoiceId, 'replay invoice mengembalikan dokumen yang sama (idempotent)');

  console.log('[21] POST /sales/invoices/:id/void → VOID + reversal');
  const voidRes = await app.inject({ method: 'POST', url: `/api/v1/sales/invoices/${invoiceId}/void`, headers: authHeaders });
  assert(voidRes.statusCode === 200 && voidRes.json().data.status === 'VOID', 'invoice VOID + reversal');

  console.log('\nAPI SMOKE TEST: LULUS');
} finally {
  await app.close();
  await pool.end();
}
