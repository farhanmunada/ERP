import type { FastifyReply, FastifyRequest } from 'fastify';

import { ok } from '../../core/http/response.ts';
import { auditContext } from '../iam/iam.controller.ts';
import { createAccountSchema, createJournalSchema } from './finance.schema.ts';
import * as coaService from './coa.service.ts';
import { postJournal, reverseJournal } from './journal.service.ts';
import { balanceSheet, profitAndLoss, trialBalance } from './reports.service.ts';
import { JOURNAL_SOURCE } from './finance.types.ts';

function companyOf(request: FastifyRequest): string {
  return request.authUser?.companyId ?? '';
}

export async function createAccountHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createAccountSchema.parse(request.body);
  const id = await coaService.createAccount({ companyId: companyOf(request), ...body, parentId: body.parentId ?? null });
  reply.status(201).send(ok({ id }));
}

export async function listAccountsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await coaService.listAccounts(companyOf(request))));
}

export async function createJournalHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createJournalSchema.parse(request.body);
  const ctx = auditContext(request);
  const result = await postJournal(
    { companyId: companyOf(request), entryDate: body.entryDate, description: body.description, sourceType: JOURNAL_SOURCE.MANUAL, lines: body.lines },
    ctx.userId ?? 'system',
  );
  reply.status(201).send(ok(result));
}

export async function reverseJournalHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const result = await reverseJournal(companyOf(request), id, auditContext(request).userId ?? 'system');
  reply.status(201).send(ok(result));
}

export async function trialBalanceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await trialBalance(companyOf(request))));
}

export async function balanceSheetHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await balanceSheet(companyOf(request))));
}

export async function profitLossHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(await profitAndLoss(companyOf(request))));
}
