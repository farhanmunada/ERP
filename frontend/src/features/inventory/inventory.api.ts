import { apiRequest } from '../../shared/lib/api-client.ts';

export interface Item {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly uom: string;
  readonly costingMethod: 'MOVING_AVERAGE' | 'FIFO';
  readonly trackBatch: boolean;
  readonly trackSerial: boolean;
  readonly reorderPoint: string;
  readonly isActive: boolean;
}

export interface Warehouse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface StockRow {
  readonly id: string;
  readonly itemId: string;
  readonly itemCode: string;
  readonly itemName: string;
  readonly uom: string;
  readonly warehouseId: string;
  readonly onHand: string;
  readonly reserved: string;
  readonly available: string;
  readonly avgCost: string;
  readonly value: string;
  readonly updatedAt: string;
}

export interface Movement {
  readonly id: string;
  readonly itemId: string;
  readonly itemCode: string;
  readonly itemName: string;
  readonly warehouseId: string;
  readonly movementType: string;
  readonly quantity: string;
  readonly unitCost: string;
  readonly totalCost: string;
  readonly balanceQty: string;
  readonly balanceValue: string;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly batchNo: string | null;
  readonly createdAt: string;
}

export interface Transfer {
  readonly id: string;
  readonly docNumber: string;
  readonly itemId: string;
  readonly fromWarehouseId: string;
  readonly toWarehouseId: string;
  readonly quantity: string;
  readonly status: 'IN_TRANSIT' | 'COMPLETED';
  readonly createdAt: string;
}

export interface StockMutationResult {
  readonly movementId: string;
  readonly onHand: string;
  readonly unitCost: string;
  readonly totalCost: string;
}

export interface OpnameResult {
  readonly id: string;
  readonly docNumber: string;
  readonly journalEntryId: string | null;
  readonly adjustments: readonly { readonly itemId: string; readonly differenceQty: string; readonly adjustmentValue: string }[];
}

export function listItems(): Promise<Item[]> {
  return apiRequest<Item[]>('/items');
}

export function createItem(payload: {
  code: string;
  name: string;
  uom: string;
  costingMethod: string;
  trackBatch: boolean;
  trackSerial: boolean;
  reorderPoint: string;
}): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/items', { method: 'POST', body: payload });
}

export function listWarehouses(): Promise<Warehouse[]> {
  return apiRequest<Warehouse[]>('/warehouses');
}

export function listStock(filter: { itemId?: string; warehouseId?: string } = {}): Promise<StockRow[]> {
  const params = new URLSearchParams();
  if (filter.itemId) params.set('itemId', filter.itemId);
  if (filter.warehouseId) params.set('warehouseId', filter.warehouseId);
  const query = params.toString();
  return apiRequest<StockRow[]>(`/inventory/stock${query ? `?${query}` : ''}`);
}

export function listMovements(filter: { itemId?: string; warehouseId?: string } = {}): Promise<Movement[]> {
  const params = new URLSearchParams();
  if (filter.itemId) params.set('itemId', filter.itemId);
  if (filter.warehouseId) params.set('warehouseId', filter.warehouseId);
  const query = params.toString();
  return apiRequest<Movement[]>(`/inventory/movements${query ? `?${query}` : ''}`);
}

export function stockIn(payload: {
  itemId: string;
  warehouseId: string;
  quantity: string;
  unitCost: string;
  batchNo?: string;
  serialNumbers?: string[];
}): Promise<StockMutationResult> {
  return apiRequest<StockMutationResult>('/inventory/stock-in', {
    method: 'POST',
    body: payload,
    idempotencyKey: crypto.randomUUID(),
  });
}

export function stockOut(payload: {
  itemId: string;
  warehouseId: string;
  quantity: string;
  serialNumbers?: string[];
}): Promise<StockMutationResult> {
  return apiRequest<StockMutationResult>('/inventory/stock-out', {
    method: 'POST',
    body: payload,
    idempotencyKey: crypto.randomUUID(),
  });
}

export function createTransfer(payload: {
  itemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: string;
}): Promise<{ id: string; docNumber: string; status: string }> {
  return apiRequest<{ id: string; docNumber: string; status: string }>('/inventory/transfer', {
    method: 'POST',
    body: payload,
    idempotencyKey: crypto.randomUUID(),
  });
}

export function completeTransfer(id: string): Promise<{ id: string; docNumber: string; status: string }> {
  return apiRequest<{ id: string; docNumber: string; status: string }>(`/inventory/transfer/${id}/complete`, {
    method: 'POST',
  });
}

export function listTransfers(): Promise<Transfer[]> {
  return apiRequest<Transfer[]>('/inventory/transfers');
}

export function createOpname(payload: {
  warehouseId: string;
  opnameDate: string;
  lines: readonly { itemId: string; physicalQty: string }[];
}): Promise<OpnameResult> {
  return apiRequest<OpnameResult>('/inventory/opname', {
    method: 'POST',
    body: payload,
    idempotencyKey: crypto.randomUUID(),
  });
}
