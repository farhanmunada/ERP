import { z } from 'zod';

export const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(150),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  parentId: z.string().uuid().nullish(),
});
export type CreateAccountDto = z.infer<typeof createAccountSchema>;

export const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Debit harus format angka desimal'),
  credit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Kredit harus format angka desimal'),
  description: z.string().max(255).optional(),
});

export const createJournalSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  description: z.string().min(3).max(255),
  lines: z.array(journalLineSchema).min(2, 'Minimal 2 baris'),
});
export type CreateJournalDto = z.infer<typeof createJournalSchema>;
