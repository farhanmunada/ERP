import { fromMinorUnits, toMinorUnits } from '../../core/money.ts';
import type { Tx } from '../../core/database/transaction.ts';
import * as docRepo from './sales-documents.repository.ts';
import { INVOICE_STATUS } from './sales.types.ts';

// Outstanding AR = Σ POSTED invoice totals − Σ credit note totals (document-based, deterministic in P0).
export async function outstandingFor(tx: Tx, companyId: string, customerId: string): Promise<string> {
  const invoices = await docRepo.sumOutstandingByCustomer(tx, companyId, customerId);
  const notes = await docRepo.sumCreditNotesByCustomer(tx, companyId, customerId);

  let outstandingCents = 0n;
  for (const invoice of invoices) {
    if (invoice.status === INVOICE_STATUS.POSTED) outstandingCents += toMinorUnits(invoice.total);
  }
  for (const note of notes) {
    outstandingCents -= toMinorUnits(note.total);
  }
  return fromMinorUnits(outstandingCents > 0n ? outstandingCents : 0n);
}
