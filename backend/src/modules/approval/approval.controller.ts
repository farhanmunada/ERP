import type { FastifyReply, FastifyRequest } from 'fastify';

import { ok } from '../../core/http/response.ts';
import { auditContext } from '../iam/iam.controller.ts';
import { createApprovalRuleSchema, decideApprovalSchema, submitApprovalSchema } from './approval.schema.ts';
import * as service from './approval.service.ts';

function companyOf(request: FastifyRequest): string {
  return request.authUser?.companyId ?? '';
}

export async function createRuleHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createApprovalRuleSchema.parse(request.body);
  const id = await service.createRule({
    companyId: companyOf(request),
    documentType: body.documentType,
    minAmount: body.minAmount,
    maxAmount: body.maxAmount ?? null,
    levels: body.levels,
  });
  reply.status(201).send(ok({ id }));
}

export async function submitApprovalHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = submitApprovalSchema.parse(request.body);
  const id = await service.submitForApproval({
    companyId: companyOf(request),
    documentType: body.documentType,
    documentId: body.documentId,
    amount: body.amount,
    userId: auditContext(request).userId ?? 'system',
  });
  reply.status(201).send(ok({ id }));
}

export async function decideApprovalHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = decideApprovalSchema.parse(request.body);
  const result = await service.decide({
    companyId: companyOf(request),
    requestId: id,
    action: body.action,
    userId: auditContext(request).userId ?? 'system',
    ...(body.note ? { note: body.note } : {}),
  });
  reply.status(200).send(ok(result));
}
