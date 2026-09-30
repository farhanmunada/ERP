import * as repo from './procurement.repository.ts';

export interface UpdateSettingsInput {
  readonly companyId: string;
  readonly qtyTolerancePct: string;
  readonly priceTolerancePct: string;
}

const DEFAULT_SETTINGS = { qtyTolerancePct: '2.00', priceTolerancePct: '2.00' } as const;

export async function getSettings(companyId: string) {
  const settings = await repo.findSettings(companyId);
  return settings ?? { companyId, ...DEFAULT_SETTINGS };
}

export async function updateSettings(input: UpdateSettingsInput) {
  await repo.upsertSettings({
    companyId: input.companyId,
    qtyTolerancePct: input.qtyTolerancePct,
    priceTolerancePct: input.priceTolerancePct,
  });
  return getSettings(input.companyId);
}
