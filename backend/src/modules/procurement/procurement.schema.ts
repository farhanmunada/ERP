import { z } from 'zod';

const qtyPattern = /^\d+(\.\d{1,4})?$/;
const moneyPattern = /^\d+(\.\d{1,2})?$/;
const pctPattern = /^\d+(\.\d{1,2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createVendorSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(2).max(150),
  email: z.string().email().max(150).nullish(),
  phone: z.string().max(30).nullish(),
  address: z.string().max(255).nullish(),
  npwp: z.string().max(30).nullish(),
  paymentTermDays: z.number().int().min(0).max(365).default(30),
});
export type CreateVendorDto = z.infer<typeof createVendorSchema>;

export const createPrSchema = z.object({
  prDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  notes: z.string().max(255).nullish(),
  lines: z
    .array(z.object({ itemId: z.string().uuid(), qty: z.string().regex(qtyPattern, 'Kuantitas tidak valid'), notes: z.string().max(255).nullish() }))
    .min(1, 'Minimal 1 baris'),
});
export type CreatePrDto = z.infer<typeof createPrSchema>;

export const convertPrSchema = z.object({
  vendorId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  poDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  tax: z.string().regex(moneyPattern, 'Pajak tidak valid').default('0'),
  lines: z
    .array(z.object({ itemId: z.string().uuid(), qty: z.string().regex(qtyPattern, 'Kuantitas tidak valid'), unitPrice: z.string().regex(moneyPattern, 'Harga tidak valid') }))
    .min(1, 'Minimal 1 baris'),
});
export type ConvertPrDto = z.infer<typeof convertPrSchema>;

export const createPoSchema = z.object({
  poDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  vendorId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  tax: z.string().regex(moneyPattern, 'Pajak tidak valid').default('0'),
  lines: z
    .array(z.object({ itemId: z.string().uuid(), qty: z.string().regex(qtyPattern, 'Kuantitas tidak valid'), unitPrice: z.string().regex(moneyPattern, 'Harga tidak valid') }))
    .min(1, 'Minimal 1 baris'),
});
export type CreatePoDto = z.infer<typeof createPoSchema>;

export const createGrnSchema = z.object({
  poId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  grnDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  lines: z
    .array(
      z.object({
        poLineId: z.string().uuid(),
        qtyReceived: z.string().regex(qtyPattern, 'Kuantitas diterima tidak valid'),
        batchNo: z.string().max(50).nullish(),
      }),
    )
    .min(1, 'Minimal 1 baris'),
});
export type CreateGrnDto = z.infer<typeof createGrnSchema>;

export const createBillSchema = z.object({
  billDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  vendorId: z.string().uuid(),
  poId: z.string().uuid().nullish(),
  tax: z.string().regex(moneyPattern, 'Pajak tidak valid').default('0'),
  lines: z
    .array(
      z.object({
        poLineId: z.string().uuid().nullish(),
        itemId: z.string().uuid(),
        qty: z.string().regex(qtyPattern, 'Kuantitas tidak valid'),
        unitPrice: z.string().regex(moneyPattern, 'Harga tidak valid'),
      }),
    )
    .min(1, 'Minimal 1 baris'),
});
export type CreateBillDto = z.infer<typeof createBillSchema>;

export const overrideBillSchema = z.object({
  reason: z.string().min(5).max(255),
});
export type OverrideBillDto = z.infer<typeof overrideBillSchema>;

export const updateSettingsSchema = z.object({
  qtyTolerancePct: z.string().regex(pctPattern, 'Toleransi qty tidak valid'),
  priceTolerancePct: z.string().regex(pctPattern, 'Toleransi harga tidak valid'),
});
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
