import { sumMinorUnits } from '../../core/money.ts';
import type { JournalInput, JournalLineInput } from './finance.types.ts';

// Pure validation of a journal before persistence: double-entry balance rules.
export function validateJournalBalance(lines: readonly JournalLineInput[]): void {
  if (lines.length < 2) {
    throw new Error('Jurnal harus memiliki minimal 2 baris (debit dan kredit)');
  }

  const totalDebit = sumMinorUnits(lines.map((line) => line.debit));
  const totalCredit = sumMinorUnits(lines.map((line) => line.credit));

  if (totalDebit !== totalCredit) {
    throw new Error('Jurnal tidak balance (debit ≠ kredit)');
  }
  if (totalDebit === 0n) {
    throw new Error('Jurnal tidak boleh bernilai nol');
  }
}

export function buildReversalLines(lines: readonly JournalLineInput[]): JournalLineInput[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    debit: line.credit,
    credit: line.debit,
    ...(line.description ? { description: `Reversal: ${line.description}` } : {}),
  }));
}

export function assertJournalInput(input: JournalInput): void {
  if (!input.description.trim()) {
    throw new Error('Deskripsi jurnal wajib diisi');
  }
  validateJournalBalance(input.lines);
}
