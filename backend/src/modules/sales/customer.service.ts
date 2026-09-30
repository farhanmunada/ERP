import { randomUUID } from 'node:crypto';

import { ConflictError, NotFoundError } from '../../core/errors/app-error.ts';
import * as repo from './sales.repository.ts';

export interface CreateCustomerInput {
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly address?: string | null;
  readonly npwp?: string | null;
  readonly creditLimit: string;
  readonly paymentTermDays: number;
}

export async function createCustomer(input: CreateCustomerInput): Promise<string> {
  if (await repo.findCustomerByCode(input.companyId, input.code)) {
    throw new ConflictError(`Kode customer "${input.code}" sudah digunakan`);
  }
  const id = randomUUID();
  await repo.insertCustomer({
    id,
    companyId: input.companyId,
    code: input.code,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    npwp: input.npwp ?? null,
    creditLimit: input.creditLimit,
    paymentTermDays: input.paymentTermDays,
  });
  return id;
}

export function listCustomers(companyId: string) {
  return repo.listCustomers(companyId);
}

export async function requireCustomer(companyId: string, id: string) {
  const customer = await repo.findCustomerById(companyId, id);
  if (!customer) throw new NotFoundError('Customer', id);
  return customer;
}
