import type { FastifyReply, FastifyRequest } from 'fastify';

import { ok } from '../../core/http/response.ts';
import { withIdempotency } from '../../core/middleware/idempotency.middleware.ts';
import { auditContext } from '../iam/iam.controller.ts';
import { createItemSchema, movementQuerySchema, opnameSchema, stockInSchema, stockOutSchema, stockQuerySchema, transferSchema, updateItemSchema } from './inventory.schema.ts';
import * as itemService from './item.service.ts';
import { completeTransfer, createTransfer, listTransfers } from './transfer.service.ts';
import { createOpname, listOpnames } from './opname.service.ts';
import { listMovements, listStock, stockIn, stockOut } from './stock.service.ts';

function companyOf(request: FastifyRequest): string {
  return request.authUser?.companyId ?? '';
}

function userOf(request: FastifyRequest): string {
  return auditContext(request).userId ?? 'system';
}

// --- Items ---
export async function createItemHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createItemSchema.parse(request.body);
  const id = await itemService.createItem({ companyId: companyOf(request), ...body });
  reply.status(201).send(ok({ id }));
}

export async function listItemsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await itemService.listItems(companyOf(request))));
}

export async function getItemHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  reply.status(200).send(ok(await itemService.getItem(companyOf(request), id)));
}

export async function updateItemHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = updateItemSchema.parse(request.body);
  await itemService.updateItem(companyOf(request), id, body);
  reply.status(200).send(ok({ id }));
}

// --- Stock ---
export async function listStockHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const query = stockQuerySchema.parse(request.query);
  const data = await listStock(companyOf(request), {
    itemId: query.itemId,
    warehouseId: query.warehouseId,
    onlyPositive: query.onlyPositive === 'true',
  });
  reply.status(200).send(ok(data));
}

export async function stockInHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = stockInSchema.parse(request.body);
  await withIdempotency(request, reply, () =>
    stockIn({ companyId: companyOf(request), userId: userOf(request), ...body }),
  );
}

export async function stockOutHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = stockOutSchema.parse(request.body);
  await withIdempotency(request, reply, () =>
    stockOut({ companyId: companyOf(request), userId: userOf(request), ...body }),
  );
}

export async function listMovementsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const query = movementQuerySchema.parse(request.query);
  reply.status(200).send(ok(await listMovements(companyOf(request), query)));
}

// --- Transfer ---
export async function createTransferHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = transferSchema.parse(request.body);
  await withIdempotency(request, reply, () =>
    createTransfer({ companyId: companyOf(request), userId: userOf(request), ...body }),
  );
}

export async function completeTransferHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const result = await completeTransfer(companyOf(request), id, userOf(request));
  reply.status(200).send(ok(result));
}

export async function listTransfersHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { status } = request.query as { status?: string };
  reply.status(200).send(ok(await listTransfers(companyOf(request), status)));
}

// --- Opname ---
export async function createOpnameHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = opnameSchema.parse(request.body);
  await withIdempotency(request, reply, () =>
    createOpname({ companyId: companyOf(request), userId: userOf(request), ...body }),
  );
}

export async function listOpnamesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { warehouseId } = request.query as { warehouseId?: string };
  reply.status(200).send(ok(await listOpnames(companyOf(request), warehouseId)));
}
