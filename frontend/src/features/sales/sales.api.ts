import { apiRequest } from '../../shared/lib/api-client.ts';

export interface Customer {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly npwp: string | null;
  readonly creditLimit: string;
  readonly paymentTermDays: number;
  readonly isActive: boolean;
}

export interface QuotationLine {
  readonly id: string;
  readonly itemId: string;
  readonly qty: string;
  readonly unitPrice: string;
  readonly discount: string;
  readonly subtotal: string;
}

export interface Quotation {
  readonly id: string;
  readonly docNumber: string;
  readonly quoteDate: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly status: 'DRAFT' | 'ACCEPTED' | 'CONVERTED';
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
}

export interface QuotationDetail {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly lines: readonly QuotationLine[];
}

export interface SalesOrderListItem {
  readonly id: string;
  readonly docNumber: string;
  readonly soDate: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly warehouseId: string;
  readonly status: string;
  readonly total: string;
}

export interface SalesOrderLine {
  readonly id: string;
  readonly itemId: string;
  readonly qty: string;
  readonly unitPrice: string;
  readonly discount: string;
  readonly subtotal: string;
  readonly deliveredQty: string;
  readonly invoicedQty: string;
}

export interface SalesOrderDetail {
  readonly id: string;
  readonly docNumber: string;
  readonly soDate: string;
  readonly customerId: string;
  readonly warehouseId: string;
  readonly status: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly lines: readonly SalesOrderLine[];
}

export interface DeliveryOrder {
  readonly id: string;
  readonly docNumber: string;
  readonly doDate: string;
  readonly soId: string;
  readonly soDocNumber: string;
  readonly warehouseId: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface CustomerInvoice {
  readonly id: string;
  readonly docNumber: string;
  readonly invoiceDate: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly status: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly cogs: string;
  readonly createdAt: string;
}

export interface CustomerInvoiceDetail {
  readonly id: string;
  readonly docNumber: string;
  readonly status: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly cogs: string;
  readonly lines: readonly {
    readonly id: string;
    readonly itemId: string;
    readonly qty: string;
    readonly unitPrice: string;
    readonly amount: string;
    readonly unitCost: string;
    readonly cogsAmount: string;
  }[];
}

// --- Customers ---
export function listCustomers(): Promise<Customer[]> {
  return apiRequest<Customer[]>('/customers');
}

export function createCustomer(payload: {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  npwp?: string;
  creditLimit: string;
  paymentTermDays: number;
}): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/customers', { method: 'POST', body: payload });
}

// --- Quotations ---
export function listQuotations(): Promise<Quotation[]> {
  return apiRequest<Quotation[]>('/sales/quotations');
}

export function getQuotation(id: string): Promise<QuotationDetail> {
  return apiRequest<QuotationDetail>(`/sales/quotations/${id}`);
}

export function createQuotation(payload: {
  quoteDate: string;
  customerId: string;
  tax: string;
  lines: readonly { itemId: string; qty: string; unitPrice: string }[];
}): Promise<{ id: string; docNumber: string; total: string }> {
  return apiRequest<{ id: string; docNumber: string; total: string }>('/sales/quotations', { method: 'POST', body: payload });
}

export function acceptQuotation(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/sales/quotations/${id}/accept`, { method: 'POST' });
}

export function convertQuotationToSo(
  id: string,
  payload: { warehouseId: string; soDate: string },
): Promise<{ id: string; docNumber: string; total: string }> {
  return apiRequest<{ id: string; docNumber: string; total: string }>(`/sales/quotations/${id}/convert-to-so`, {
    method: 'POST',
    body: payload,
  });
}

// --- Sales Orders ---
export function listSalesOrders(): Promise<SalesOrderListItem[]> {
  return apiRequest<SalesOrderListItem[]>('/sales/orders');
}

export function getSalesOrder(id: string): Promise<SalesOrderDetail> {
  return apiRequest<SalesOrderDetail>(`/sales/orders/${id}`);
}

export function createSalesOrder(payload: {
  soDate: string;
  customerId: string;
  warehouseId: string;
  tax: string;
  lines: readonly { itemId: string; qty: string; unitPrice: string }[];
}): Promise<{ id: string; docNumber: string; total: string }> {
  return apiRequest<{ id: string; docNumber: string; total: string }>('/sales/orders', { method: 'POST', body: payload });
}

export function confirmSalesOrder(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/sales/orders/${id}/confirm`, { method: 'POST' });
}

export function cancelSalesOrder(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/sales/orders/${id}/cancel`, { method: 'POST' });
}

// --- Delivery Orders ---
export function listDeliveries(): Promise<DeliveryOrder[]> {
  return apiRequest<DeliveryOrder[]>('/sales/deliveries');
}

export function createDelivery(payload: {
  soId: string;
  doDate: string;
  lines: readonly { soLineId: string; qtyDelivered: string; batchNo?: string }[];
}): Promise<{ id: string; docNumber: string; status: string; cogs: string }> {
  return apiRequest('/sales/deliveries', { method: 'POST', body: payload, idempotencyKey: crypto.randomUUID() });
}

// --- Customer Invoices ---
export function listInvoices(): Promise<CustomerInvoice[]> {
  return apiRequest<CustomerInvoice[]>('/sales/invoices');
}

export function getInvoice(id: string): Promise<CustomerInvoiceDetail> {
  return apiRequest<CustomerInvoiceDetail>(`/sales/invoices/${id}`);
}

export function createInvoice(payload: {
  doId: string;
  invoiceDate: string;
  tax: string;
}): Promise<{ id: string; docNumber: string; status: string; total: string; cogs: string }> {
  return apiRequest('/sales/invoices', { method: 'POST', body: payload, idempotencyKey: crypto.randomUUID() });
}

export function voidInvoice(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/sales/invoices/${id}/void`, { method: 'POST' });
}

export function createCreditNote(
  id: string,
  payload: { cnDate: string; lines: readonly { invoiceLineId: string; qty: string }[] },
): Promise<{ id: string; docNumber: string; total: string }> {
  return apiRequest<{ id: string; docNumber: string; total: string }>(`/sales/invoices/${id}/credit-note`, {
    method: 'POST',
    body: payload,
  });
}
