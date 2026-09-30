import { z } from 'zod';

const qtyPattern = /^\d+(\.\d{1,4})?$/;
const moneyPattern = /^\d+(\.\d{1,2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createCustomerSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(2).max(150),
  email: z.string().email().max(150).nullish(),
  phone: z.string().max(30).nullish(),
  address: z.string().max(255).nullish(),
  npwp: z.string().max(30).nullish(),
  creditLimit: z.string().regex(moneyPattern, 'Credit limit tidak valid').default('0'),
  paymentTermDays: z.number().int().min(0).max(365).default(30),
});
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

export const createQuotationSchema = z.object({
  quoteDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  customerId: z.string().uuid(),
  validUntil: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD').nullish(),
  tax: z.string().regex(moneyPattern, 'Pajak tidak valid').default('0'),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qty: z.string().regex(qtyPattern, 'Kuantitas tidak valid'),
        unitPrice: z.string().regex(moneyPattern, 'Harga tidak valid'),
      }),
    )
    .min(1, 'Minimal 1 baris'),
});
export type CreateQuotationDto = z.infer<typeof createQuotationSchema>;

export const convertQuotationSchema = z.object({
  warehouseId: z.string().uuid(),
  soDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
});
export type ConvertQuotationDto = z.infer<typeof convertQuotationSchema>;

export const createSoSchema = z.object({
  soDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  customerId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  tax: z.string().regex(moneyPattern, 'Pajak tidak valid').default('0'),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qty: z.string().regex(qtyPattern, 'Kuantitas tidak valid'),
        unitPrice: z.string().regex(moneyPattern, 'Harga tidak valid'),
      }),
    )
    .min(1, 'Minimal 1 baris'),
});
export type CreateSoDto = z.infer<typeof createSoSchema>;

export const createDeliverySchema = z.object({
  soId: z.string().uuid(),
  doDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  lines: z
    .array(
      z.object({
        soLineId: z.string().uuid(),
        qtyDelivered: z.string().regex(qtyPattern, 'Kuantitas kirim tidak valid'),
        batchNo: z.string().max(50).nullish(),
      }),
    )
    .min(1, 'Minimal 1 baris'),
});
export type CreateDeliveryDto = z.infer<typeof createDeliverySchema>;

export const createInvoiceSchema = z.object({
  doId: z.string().uuid(),
  invoiceDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  tax: z.string().regex(moneyPattern, 'Pajak tidak valid').default('0'),
});
export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;

export const createCreditNoteSchema = z.object({
  cnDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  lines: z
    .array(
      z.object({
        invoiceLineId: z.string().uuid(),
        qty: z.string().regex(qtyPattern, 'Kuantitas retur tidak valid'),
      }),
    )
    .min(1, 'Minimal 1 baris'),
});
export type CreateCreditNoteDto = z.infer<typeof createCreditNoteSchema>;
