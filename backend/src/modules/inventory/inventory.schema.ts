import { z } from 'zod';

const qtyPattern = /^\d+(\.\d{1,4})?$/;
const moneyPattern = /^\d+(\.\d{1,2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createItemSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(2).max(150),
  uom: z.string().min(1).max(20),
  costingMethod: z.enum(['MOVING_AVERAGE', 'FIFO']).default('MOVING_AVERAGE'),
  trackBatch: z.boolean().default(false),
  trackSerial: z.boolean().default(false),
  reorderPoint: z.string().regex(qtyPattern, 'Reorder point harus angka (maks 4 desimal)').default('0'),
});
export type CreateItemDto = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  uom: z.string().min(1).max(20).optional(),
  reorderPoint: z.string().regex(qtyPattern).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateItemDto = z.infer<typeof updateItemSchema>;

export const stockInSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.string().regex(qtyPattern, 'Kuantitas harus angka (maks 4 desimal)'),
  unitCost: z.string().regex(moneyPattern, 'Harga satuan harus angka (maks 2 desimal)'),
  referenceType: z.string().max(30).nullish(),
  referenceId: z.string().max(64).nullish(),
  batchNo: z.string().max(50).nullish(),
  serialNumbers: z.array(z.string().min(1).max(80)).optional(),
});
export type StockInDto = z.infer<typeof stockInSchema>;

export const stockOutSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.string().regex(qtyPattern, 'Kuantitas harus angka (maks 4 desimal)'),
  referenceType: z.string().max(30).nullish(),
  referenceId: z.string().max(64).nullish(),
  serialNumbers: z.array(z.string().min(1).max(80)).optional(),
});
export type StockOutDto = z.infer<typeof stockOutSchema>;

export const transferSchema = z.object({
  itemId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.string().regex(qtyPattern, 'Kuantitas harus angka (maks 4 desimal)'),
});
export type TransferDto = z.infer<typeof transferSchema>;

export const opnameSchema = z.object({
  warehouseId: z.string().uuid(),
  opnameDate: z.string().regex(datePattern, 'Format tanggal harus YYYY-MM-DD'),
  lines: z
    .array(z.object({ itemId: z.string().uuid(), physicalQty: z.string().regex(qtyPattern, 'Kuantitas fisik harus angka') }))
    .min(1, 'Minimal 1 baris'),
});
export type OpnameDto = z.infer<typeof opnameSchema>;

export const stockQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  onlyPositive: z.enum(['true', 'false']).optional(),
});

export const movementQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  movementType: z.string().max(30).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
