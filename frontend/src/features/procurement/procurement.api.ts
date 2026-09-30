import { apiRequest } from '../../shared/lib/api-client.ts';

export interface Vendor {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly npwp: string | null;
  readonly paymentTermDays: number;
  readonly isActive: boolean;
}

export interface PrLine {
  readonly id: string;
  readonly itemId: string;
  readonly qty: string;
}

export interface PurchaseRequisition {
  readonly id: string;
  readonly docNumber: string;
  readonly prDate: string;
  readonly status: 'DRAFT' | 'APPROVED' | 'CONVERTED';
  readonly notes: string | null;
}

export interface PurchaseRequisitionDetail extends PurchaseRequisition {
  readonly lines: readonly PrLine[];
}

export interface PoListItem {
  readonly id: string;
  readonly docNumber: string;
  readonly poDate: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly warehouseId: string;
  readonly status: string;
  readonly total: string;
}

export interface PoLine {
  readonly id: string;
  readonly itemId: string;
  readonly qty: string;
  readonly unitPrice: string;
  readonly receivedQty: string;
  readonly billedQty: string;
}

export interface PurchaseOrderDetail {
  readonly id: string;
  readonly docNumber: string;
  readonly poDate: string;
  readonly vendorId: string;
  readonly warehouseId: string;
  readonly status: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly lines: readonly PoLine[];
}

export interface Grn {
  readonly id: string;
  readonly docNumber: string;
  readonly grnDate: string;
  readonly poId: string;
  readonly warehouseId: string;
  readonly status: string;
  readonly journalEntryId: string | null;
  readonly createdAt: string;
}

export interface MatchLine {
  readonly itemId: string;
  readonly poLineId: string;
  readonly qtyPo: string;
  readonly qtyGrn: string;
  readonly qtyBill: string;
  readonly pricePo: string;
  readonly priceBill: string;
  readonly qtyDiffPct: string;
  readonly priceDiffPct: string;
  readonly status: 'OK' | 'EXCEPTION';
}

export interface MatchResult {
  readonly status: 'PASS' | 'EXCEPTION';
  readonly tolerance: { readonly qtyPct: string; readonly pricePct: string };
  readonly lines: readonly MatchLine[];
}

export interface VendorBill {
  readonly id: string;
  readonly docNumber: string;
  readonly billDate: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly poId: string | null;
  readonly status: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly createdAt: string;
}

export interface BillDetail {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly matchResult: MatchResult | null;
  readonly overrideReason: string | null;
  readonly lines: readonly { readonly id: string; readonly itemId: string; readonly qty: string; readonly unitPrice: string; readonly amount: string }[];
}

export interface ProcurementSettings {
  readonly qtyTolerancePct: string;
  readonly priceTolerancePct: string;
}

// --- Vendors ---
export function listVendors(): Promise<Vendor[]> {
  return apiRequest<Vendor[]>('/vendors');
}

export function createVendor(payload: {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  npwp?: string;
  paymentTermDays: number;
}): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/vendors', { method: 'POST', body: payload });
}

// --- Purchase Requisitions ---
export function listPrs(): Promise<PurchaseRequisition[]> {
  return apiRequest<PurchaseRequisition[]>('/procurement/pr');
}

export function createPr(payload: { prDate: string; lines: readonly { itemId: string; qty: string }[] }): Promise<{ id: string; docNumber: string }> {
  return apiRequest<{ id: string; docNumber: string }>('/procurement/pr', { method: 'POST', body: payload });
}

export function approvePr(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/procurement/pr/${id}/approve`, { method: 'POST' });
}

export function getPr(id: string): Promise<PurchaseRequisitionDetail> {
  return apiRequest<PurchaseRequisitionDetail>(`/procurement/pr/${id}`);
}

export function convertPrToPo(
  prId: string,
  payload: {
    vendorId: string;
    warehouseId: string;
    poDate: string;
    tax: string;
    lines: readonly { itemId: string; qty: string; unitPrice: string }[];
  },
): Promise<{ id: string; docNumber: string; total: string }> {
  return apiRequest<{ id: string; docNumber: string; total: string }>(`/procurement/pr/${prId}/convert-to-po`, {
    method: 'POST',
    body: payload,
  });
}

// --- Purchase Orders ---
export function listPos(): Promise<PoListItem[]> {
  return apiRequest<PoListItem[]>('/procurement/po');
}

export function createPo(payload: {
  poDate: string;
  vendorId: string;
  warehouseId: string;
  tax: string;
  lines: readonly { itemId: string; qty: string; unitPrice: string }[];
}): Promise<{ id: string; docNumber: string; total: string }> {
  return apiRequest<{ id: string; docNumber: string; total: string }>('/procurement/po', { method: 'POST', body: payload });
}

export function getPo(id: string): Promise<PurchaseOrderDetail> {
  return apiRequest<PurchaseOrderDetail>(`/procurement/po/${id}`);
}

export function submitPo(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/procurement/po/${id}/submit`, { method: 'POST' });
}

export function approvePo(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/procurement/po/${id}/approve`, { method: 'POST', body: {} });
}

export function rejectPo(id: string, note: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/procurement/po/${id}/reject`, { method: 'POST', body: { note } });
}

// --- Goods Receipts ---
export function listGrns(): Promise<Grn[]> {
  return apiRequest<Grn[]>('/procurement/grn');
}

export function createGrn(payload: {
  poId: string;
  warehouseId: string;
  grnDate: string;
  lines: readonly { poLineId: string; qtyReceived: string; batchNo?: string }[];
}): Promise<{ id: string; docNumber: string; status: string; journalEntryId: string | null; receivedValue: string }> {
  return apiRequest('/procurement/grn', { method: 'POST', body: payload, idempotencyKey: crypto.randomUUID() });
}

// --- Vendor Bills ---
export function listBills(): Promise<VendorBill[]> {
  return apiRequest<VendorBill[]>('/procurement/bills');
}

export function getBill(id: string): Promise<BillDetail> {
  return apiRequest<BillDetail>(`/procurement/bills/${id}`);
}

export function createBill(payload: {
  billDate: string;
  vendorId: string;
  poId?: string | null;
  tax: string;
  lines: readonly { poLineId?: string | null; itemId: string; qty: string; unitPrice: string }[];
}): Promise<{ id: string; docNumber: string; status: string; total: string; match: MatchResult | null }> {
  return apiRequest('/procurement/bills', { method: 'POST', body: payload });
}

export function overrideBill(id: string, reason: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/procurement/bills/${id}/override`, { method: 'POST', body: { reason } });
}

export function postBill(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/procurement/bills/${id}/post`, { method: 'POST' });
}

export function getSettings(): Promise<ProcurementSettings> {
  return apiRequest<ProcurementSettings>('/procurement/settings');
}
