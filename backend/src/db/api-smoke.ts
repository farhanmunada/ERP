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

  console.log('\nAPI SMOKE TEST: LULUS');
} finally {
  await app.close();
  await pool.end();
}
