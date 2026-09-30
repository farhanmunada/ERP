import { buildApp } from '../app.ts';
import { pool } from '../core/database/client.ts';
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, DEFAULT_COMPANY_ID } from './seed-data.ts';

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

  console.log('\nAPI SMOKE TEST: LULUS');
} finally {
  await app.close();
  await pool.end();
}
