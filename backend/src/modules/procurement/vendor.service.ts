import { randomUUID } from 'node:crypto';

import { ConflictError, NotFoundError } from '../../core/errors/app-error.ts';
import * as repo from './procurement.repository.ts';

export interface CreateVendorInput {
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly address?: string | null;
  readonly npwp?: string | null;
  readonly paymentTermDays: number;
}

export async function createVendor(input: CreateVendorInput): Promise<string> {
  const existing = await repo.findVendorByCode(input.companyId, input.code);
  if (existing) throw new ConflictError(`Kode vendor "${input.code}" sudah digunakan`);

  const id = randomUUID();
  await repo.insertVendor({
    id,
    companyId: input.companyId,
    code: input.code,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    npwp: input.npwp ?? null,
    paymentTermDays: input.paymentTermDays,
  });
  return id;
}

export function listVendors(companyId: string) {
  return repo.listVendors(companyId);
}

export async function requireVendor(companyId: string, vendorId: string) {
  const vendor = await repo.findVendorById(companyId, vendorId);
  if (!vendor) throw new NotFoundError('Vendor', vendorId);
  return vendor;
}
