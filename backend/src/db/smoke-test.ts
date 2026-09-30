import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { db, pool } from '../core/database/client.ts';
import { companies } from '../db/schema/iam.schema.ts';
import { createAccount, listAccounts } from '../modules/finance/coa.service.ts';
import { postJournal, reverseJournal } from '../modules/finance/journal.service.ts';
import { trialBalance } from '../modules/finance/reports.service.ts';
import { JOURNAL_SOURCE } from '../modules/finance/finance.types.ts';

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
  const accounts = await listAccounts(companyId);
  assert(accounts.length === 2, 'COA tersimpan 2 akun');

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

  console.log('\nSMOKE TEST TIER 2: LULUS');
} finally {
  await db.delete(companies).where(eq(companies.id, companyId));
  await pool.end();
}
