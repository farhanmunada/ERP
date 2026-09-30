import { z } from 'zod';

export const createApprovalRuleSchema = z.object({
  documentType: z.enum(['PURCHASE_ORDER', 'PURCHASE_REQUEST', 'SALES_ORDER', 'JOURNAL', 'PAYMENT']),
  minAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'minAmount harus format desimal'),
  maxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'maxAmount harus format desimal').nullish(),
  levels: z
    .array(
      z.object({
        level: z.number().int().positive(),
        roleCode: z.string().min(2).max(50),
      }),
    )
    .min(1, 'Minimal 1 level'),
});
export type CreateApprovalRuleDto = z.infer<typeof createApprovalRuleSchema>;

export const submitApprovalSchema = z.object({
  documentType: z.string().min(2).max(30),
  documentId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'amount harus format desimal'),
});
export type SubmitApprovalDto = z.infer<typeof submitApprovalSchema>;

export const decideApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  note: z.string().max(255).optional(),
});
export type DecideApprovalDto = z.infer<typeof decideApprovalSchema>;
