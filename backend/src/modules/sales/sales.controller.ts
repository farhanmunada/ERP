import type { FastifyReply, FastifyRequest } from 'fastify';

import { ok } from '../../core/http/response.ts';
import { withIdempotency } from '../../core/middleware/idempotency.middleware.ts';
import { auditContext } from '../iam/iam.controller.ts';
import {
  createCreditNoteSchema,
  createCustomerSchema,
  createDeliverySchema,
  createInvoiceSchema,
  createQuotationSchema,
  createSoSchema,
  convertQuotationSchema,
} from './sales.schema.ts';
import { createCustomer, listCustomers } from './customer.service.ts';
import { acceptQuotation, createQuotation, getQuotation, listQuotations } from './quotation.service.ts';
import { cancelSo, confirmSo, convertQuotationToSo, createSo, getSo, listSos } from './so.service.ts';
import { createDelivery, listDeliveries } from './do.service.ts';
import { createInvoice, getInvoice, listInvoices, voidInvoice } from './invoice.service.ts';
import { createCreditNote } from './credit-note.service.ts';

function companyOf(request: FastifyRequest): string {
  return request.authUser?.companyId ?? '';
}

function userOf(request: FastifyRequest): string {
  return auditContext(request).userId ?? 'system';
}

// --- Customers ---
export async function createCustomerHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createCustomerSchema.parse(request.body);
  const id = await createCustomer({ companyId: companyOf(request), ...body });
  reply.status(201).send(ok({ id }));
}

export async function listCustomersHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await listCustomers(companyOf(request))));
}

// --- Quotations ---
export async function createQuotationHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createQuotationSchema.parse(request.body);
  const result = await createQuotation({ companyId: companyOf(request), userId: userOf(request), ...body });
  reply.status(201).send(ok(result));
}

export async function listQuotationsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await listQuotations(companyOf(request))));
}

export async function getQuotationHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await getQuotation(companyOf(request), id)));
}

export async function acceptQuotationHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await acceptQuotation(companyOf(request), id, userOf(request))));
}

export async function convertQuotationHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = convertQuotationSchema.parse(request.body);
  const result = await convertQuotationToSo({ companyId: companyOf(request), quotationId: id, userId: userOf(request), ...body });
  reply.status(201).send(ok(result));
}

// --- Sales Orders ---
export async function createSoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createSoSchema.parse(request.body);
  const result = await createSo({ companyId: companyOf(request), userId: userOf(request), ...body });
  reply.status(201).send(ok(result));
}

export async function listSosHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await listSos(companyOf(request))));
}

export async function getSoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await getSo(companyOf(request), id)));
}

export async function confirmSoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await confirmSo(companyOf(request), id, userOf(request))));
}

export async function cancelSoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await cancelSo(companyOf(request), id, userOf(request))));
}

// --- Delivery Orders ---
export async function createDeliveryHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createDeliverySchema.parse(request.body);
  await withIdempotency(request, reply, () =>
    createDelivery({ companyId: companyOf(request), userId: userOf(request), ...body }),
  );
}

export async function listDeliveriesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await listDeliveries(companyOf(request))));
}

// --- Customer Invoices ---
export async function createInvoiceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createInvoiceSchema.parse(request.body);
  await withIdempotency(request, reply, () =>
    createInvoice({ companyId: companyOf(request), userId: userOf(request), ...body }),
  );
}

export async function listInvoicesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await listInvoices(companyOf(request))));
}

export async function getInvoiceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await getInvoice(companyOf(request), id)));
}

export async function voidInvoiceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await voidInvoice(companyOf(request), id, userOf(request))));
}

export async function createCreditNoteHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = createCreditNoteSchema.parse(request.body);
  const result = await createCreditNote({ companyId: companyOf(request), invoiceId: id, userId: userOf(request), ...body });
  reply.status(201).send(ok(result));
}
