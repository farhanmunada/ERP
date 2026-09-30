import { randomUUID } from 'node:crypto';

import { ConflictError, NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { ACCOUNT_TYPES, NORMAL_BALANCE } from './finance.types.ts';
import * as repo from './finance.repository.ts';

export interface CreateAccountInput {
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  readonly type: string;
  readonly parentId?: string | null;
}

const CREDIT_NORMAL_TYPES = new Set(['LIABILITY', 'EQUITY', 'REVENUE']);

function normalBalanceFor(type: string): string {
  return CREDIT_NORMAL_TYPES.has(type) ? NORMAL_BALANCE[1] : NORMAL_BALANCE[0];
}

export async function createAccount(input: CreateAccountInput): Promise<string> {
  if (!ACCOUNT_TYPES.includes(input.type as (typeof ACCOUNT_TYPES)[number])) {
    throw new UnprocessableError(`Tipe akun "${input.type}" tidak valid`);
  }

  const existing = await repo.findAccountByCode(input.companyId, input.code);
  if (existing) throw new ConflictError(`Kode akun "${input.code}" sudah digunakan`);

  if (input.parentId) {
    const parent = await repo.findAccountById(input.companyId, input.parentId);
    if (!parent) throw new NotFoundError('Parent Account', input.parentId);
  }

  const id = randomUUID();
  await repo.insertAccount({
    id,
    companyId: input.companyId,
    code: input.code,
    name: input.name,
    type: input.type,
    normalBalance: normalBalanceFor(input.type),
    parentId: input.parentId ?? null,
  });
  return id;
}

export async function listAccounts(companyId: string) {
  return repo.listAccounts(companyId);
}
