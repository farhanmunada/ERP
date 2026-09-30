import { randomUUID } from 'node:crypto';

import { ConflictError, NotFoundError, UnprocessableError } from '../../core/errors/app-error.ts';
import { COSTING_METHODS } from './inventory.types.ts';
import type { CostingMethod } from './inventory.types.ts';
import * as repo from './inventory.repository.ts';

export interface CreateItemInput {
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  readonly uom: string;
  readonly costingMethod: string;
  readonly trackBatch: boolean;
  readonly trackSerial: boolean;
  readonly reorderPoint: string;
}

export async function createItem(input: CreateItemInput): Promise<string> {
  if (!COSTING_METHODS.includes(input.costingMethod as CostingMethod)) {
    throw new UnprocessableError(`Metode costing "${input.costingMethod}" tidak valid`);
  }
  if (await repo.findItemByCode(input.companyId, input.code)) {
    throw new ConflictError(`Kode item "${input.code}" sudah digunakan`);
  }

  const id = randomUUID();
  await repo.insertItem({
    id,
    companyId: input.companyId,
    code: input.code,
    name: input.name,
    uom: input.uom,
    costingMethod: input.costingMethod,
    trackBatch: input.trackBatch,
    trackSerial: input.trackSerial,
    reorderPoint: input.reorderPoint,
  });
  return id;
}

export interface UpdateItemInput {
  readonly name?: string;
  readonly uom?: string;
  readonly reorderPoint?: string;
  readonly isActive?: boolean;
}

export async function updateItem(companyId: string, id: string, input: UpdateItemInput): Promise<void> {
  if (!(await repo.findItemById(companyId, id))) throw new NotFoundError('Item', id);
  await repo.updateItem(companyId, id, input);
}

export async function getItem(companyId: string, id: string) {
  const item = await repo.findItemById(companyId, id);
  if (!item) throw new NotFoundError('Item', id);
  return item;
}

export function listItems(companyId: string) {
  return repo.listItems(companyId);
}
