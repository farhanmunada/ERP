import type { FastifyReply, FastifyRequest } from 'fastify';

import { ok } from '../../core/http/response.ts';
import { withIdempotency } from '../../core/middleware/idempotency.middleware.ts';
import { auditContext } from '../iam/iam.controller.ts';
import {
  createBillSchema,
  createGrnSchema,
  createPoSchema,
  createPrSchema,
  createVendorSchema,
  convertPrSchema,
  overrideBillSchema,
  updateSettingsSchema,
} from './procurement.schema.ts';
import { approvePr, createPr, getPr, listPrs } from './pr.service.ts';
import { approvePo, convertPrToPo, createPo, getPo, listPos, rejectPo, submitPo } from './po.service.ts';
import { createGrn, listGrns } from './grn.service.ts';
import { createBill, getBill, listBills, overrideBill, postBill } from './bill.service.ts';
import { getSettings, updateSettings } from './settings.service.ts';
import { createVendor, listVendors } from './vendor.service.ts';

function companyOf(request: FastifyRequest): string {
  return request.authUser?.companyId ?? '';
}

function userOf(request: FastifyRequest): string {
  return auditContext(request).userId ?? 'system';
}

// --- Vendors ---
export async function createVendorHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createVendorSchema.parse(request.body);
  const id = await createVendor({ companyId: companyOf(request), ...body });
  reply.status(201).send(ok({ id }));
}

export async function listVendorsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await listVendors(companyOf(request))));
}

// --- Purchase Requisitions ---
export async function createPrHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createPrSchema.parse(request.body);
  const result = await createPr({ companyId: companyOf(request), userId: userOf(request), ...body });
  reply.status(201).send(ok(result));
}

export async function listPrsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await listPrs(companyOf(request))));
}

export async function getPrHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await getPr(companyOf(request), id)));
}

export async function approvePrHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await approvePr(companyOf(request), id, userOf(request))));
}

export async function convertPrHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = convertPrSchema.parse(request.body);
  const result = await convertPrToPo({ companyId: companyOf(request), prId: id, userId: userOf(request), ...body });
  reply.status(201).send(ok(result));
}

// --- Purchase Orders ---
export async function createPoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createPoSchema.parse(request.body);
  const result = await createPo({ companyId: companyOf(request), userId: userOf(request), ...body });
  reply.status(201).send(ok(result));
}

export async function listPosHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await listPos(companyOf(request))));
}

export async function getPoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await getPo(companyOf(request), id)));
}

export async function submitPoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await submitPo(companyOf(request), id, userOf(request))));
}

export async function approvePoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const { note } = (request.body ?? {}) as { note?: string };
  reply.status(200).send(ok(await approvePo(companyOf(request), id, userOf(request), note)));
}

export async function rejectPoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const { note } = (request.body ?? {}) as { note?: string };
  reply.status(200).send(ok(await rejectPo(companyOf(request), id, userOf(request), note)));
}

// --- Goods Receipts ---
export async function createGrnHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createGrnSchema.parse(request.body);
  await withIdempotency(request, reply, () =>
    createGrn({ companyId: companyOf(request), userId: userOf(request), ...body }),
  );
}

export async function listGrnsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await listGrns(companyOf(request))));
}

// --- Vendor Bills ---
export async function createBillHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createBillSchema.parse(request.body);
  const result = await createBill({ companyId: companyOf(request), userId: userOf(request), ...body });
  reply.status(201).send(ok(result));
}

export async function listBillsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await listBills(companyOf(request))));
}

export async function getBillHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await getBill(companyOf(request), id)));
}

export async function getBillMatchHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const bill = await getBill(companyOf(request), id);
  reply.status(200).send(ok({ id: bill.id, status: bill.status, match: bill.matchResult }));
}

export async function overrideBillHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = overrideBillSchema.parse(request.body);
  reply.status(200).send(ok(await overrideBill(companyOf(request), id, userOf(request), body.reason)));
}

export async function postBillHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await postBill(companyOf(request), id, userOf(request))));
}

// --- Settings ---
export async function getSettingsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await getSettings(companyOf(request))));
}

export async function updateSettingsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = updateSettingsSchema.parse(request.body);
  reply.status(200).send(ok(await updateSettings({ companyId: companyOf(request), ...body })));
}
