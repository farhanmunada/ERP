import { randomUUID } from 'node:crypto';

import { fromMinorUnits } from '../../core/money.ts';
import { fromQtyUnits, toQtyUnits } from '../../core/qty.ts';
import { runInTransaction } from '../../core/database/transaction.ts';
import type { Tx } from '../../core/database/transaction.ts';
import { NotFoundError } from '../../core/errors/app-error.ts';
import { writeAuditLog } from '../../core/audit/audit-log.ts';
import { writeOutboxEvent } from '../../core/outbox/outbox-writer.ts';
import { nextDocNumber } from '../../core/sequence/doc-number.ts';
import { JOURNAL_SOURCE, postJournalTx, resolveAccountId } from '../finance/index.ts';
import { inboundState, movingAverageOutbound, valueOfQty } from './costing.ts';
import type { StockState } from './costing.ts';
import * as repo from './inventory.repository.ts';
import {
  ADJUSTMENT_ACCOUNT_CODE,
  INVENTORY_ACCOUNT_CODE,
  MOVEMENT_TYPES,
  OPNAME_STATUS,
  OUTBOX_EVENT_TYPES,
} from './inventory.types.ts';
import type { CostingMethod } from './inventory.types.ts';
import { currentState, ensureStockRow, lockFifoLayers, serializeState } from './stock.helpers.ts';

export interface OpnameLineInput {
  readonly itemId: string;
  readonly physicalQty: string;
}

export interface CreateOpnameInput {
  readonly companyId: string;
  readonly warehouseId: string;
  readonly opnameDate: string;
  readonly lines: readonly OpnameLineInput[];
  readonly userId: string;
}

export interface OpnameResult {
  readonly id: string;
  readonly docNumber: string;
  readonly journalEntryId: string | null;
  readonly adjustments: readonly { readonly itemId: string; readonly differenceQty: string; readonly adjustmentValue: string }[];
}

interface AdjustedLine {
  readonly itemId: string;
  readonly systemQty: string;
  readonly physicalQty: string;
  readonly differenceQty: string;
  readonly unitCost: string;
  readonly adjustmentValueCents: bigint;
}

// Applies a physical count: adjusts on-hand, writes movements, and posts one net adjustment journal.
export async function createOpname(input: CreateOpnameInput): Promise<OpnameResult> {
  const period = input.opnameDate.slice(0, 4);

  return runInTransaction(async (tx) => {
    const id = randomUUID();
    const docNumber = await nextDocNumber(tx, { companyId: input.companyId, docType: 'OPN', prefix: 'OPN', period });
    const adjusted: AdjustedLine[] = [];

    for (const line of input.lines) {
      const item = await repo.findItemById(input.companyId, line.itemId);
      if (!item) throw new NotFoundError('Item', line.itemId);
      const method = item.costingMethod as CostingMethod;
      const row = await ensureStockRow(tx, input.companyId, line.itemId, input.warehouseId);
      const layers = method === 'FIFO' ? await lockFifoLayers(tx, line.itemId, input.warehouseId) : [];
      const prev = currentState(method, row, layers);

      const physicalUnits = toQtyUnits(line.physicalQty);
      const diffUnits = physicalUnits - prev.qtyUnits;
      if (diffUnits === 0n) {
        adjusted.push({
          itemId: line.itemId,
          systemQty: fromQtyUnits(prev.qtyUnits),
          physicalQty: line.physicalQty,
          differenceQty: '0.0000',
          unitCost: fromMinorUnits(prev.avgCostCents),
          adjustmentValueCents: 0n,
        });
        continue;
      }

      const { state, adjustmentValueCents } = applyAdjustment(method, prev, diffUnits);
      await repo.updateStock(tx, row.id, { onHand: serializeState(state).onHand, avgCost: serializeState(state).avgCost });
      await repo.insertMovement(tx, {
        id: randomUUID(),
        companyId: input.companyId,
        itemId: line.itemId,
        warehouseId: input.warehouseId,
        movementType: MOVEMENT_TYPES.OPNAME_ADJUSTMENT,
        quantity: fromQtyUnits(diffUnits < 0n ? -diffUnits : diffUnits),
        unitCost: fromMinorUnits(prev.avgCostCents),
        totalCost: fromMinorUnits(adjustmentValueCents < 0n ? -adjustmentValueCents : adjustmentValueCents),
        balanceQty: serializeState(state).onHand,
        balanceValue: fromMinorUnits(state.valueCents),
        referenceType: 'OPNAME',
        referenceId: id,
        createdBy: input.userId,
      });

      adjusted.push({
        itemId: line.itemId,
        systemQty: fromQtyUnits(prev.qtyUnits),
        physicalQty: line.physicalQty,
        differenceQty: fromQtyUnits(diffUnits),
        unitCost: fromMinorUnits(prev.avgCostCents),
        adjustmentValueCents,
      });
    }

    const journalEntryId = await postAdjustmentJournal(tx, input, id, docNumber, adjusted);

    await repo.insertOpname(tx, {
      id,
      companyId: input.companyId,
      docNumber,
      warehouseId: input.warehouseId,
      opnameDate: input.opnameDate,
      status: OPNAME_STATUS.POSTED,
      journalEntryId,
      createdBy: input.userId,
    });
    await repo.insertOpnameLines(
      tx,
      adjusted.map((line) => ({
        id: randomUUID(),
        opnameId: id,
        itemId: line.itemId,
        systemQty: line.systemQty,
        physicalQty: line.physicalQty,
        differenceQty: line.differenceQty,
        unitCost: line.unitCost,
        adjustmentValue: fromMinorUnits(line.adjustmentValueCents),
      })),
    );

    await writeOutboxEvent(tx, {
      eventType: OUTBOX_EVENT_TYPES.OPNAME_POSTED,
      aggregateType: 'stock_opname',
      aggregateId: id,
      payload: { warehouseId: input.warehouseId, journalEntryId },
    });
    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: 'OPNAME_POSTED',
      entityType: 'stock_opname',
      entityId: id,
      stateAfter: { docNumber, journalEntryId },
    });

    return {
      id,
      docNumber,
      journalEntryId,
      adjustments: adjusted.map((line) => ({
        itemId: line.itemId,
        differenceQty: line.differenceQty,
        adjustmentValue: fromMinorUnits(line.adjustmentValueCents),
      })),
    };
  });
}

// Returns the new stock state and the signed adjustment value (negative = shrinkage).
function applyAdjustment(
  method: CostingMethod,
  prev: StockState,
  diffUnits: bigint,
): { readonly state: StockState; readonly adjustmentValueCents: bigint } {
  if (diffUnits > 0n) {
    const inUnitCostCents = prev.avgCostCents;
    const state = inboundState(prev, diffUnits, inUnitCostCents);
    return { state, adjustmentValueCents: valueOfQty(diffUnits, inUnitCostCents) };
  }

  const shrinkUnits = -diffUnits;
  if (method === 'FIFO') {
    // Value the shrinkage at the running average cost so the journal stays simple.
    const valueCents = valueOfQty(shrinkUnits, prev.avgCostCents);
    const qtyUnits = prev.qtyUnits - shrinkUnits;
    return {
      state: { qtyUnits, valueCents: prev.valueCents - valueCents, avgCostCents: prev.avgCostCents },
      adjustmentValueCents: -valueCents,
    };
  }
  const { outValueCents, state } = movingAverageOutbound(prev, shrinkUnits);
  return { state, adjustmentValueCents: -outValueCents };
}

// Posts one net journal: shrinkage debits expense/credits inventory; surplus is the reverse.
async function postAdjustmentJournal(
  tx: Tx,
  input: CreateOpnameInput,
  opnameId: string,
  docNumber: string,
  adjusted: readonly AdjustedLine[],
): Promise<string | null> {
  const netValueCents = adjusted.reduce((total, line) => total + line.adjustmentValueCents, 0n);
  if (netValueCents === 0n) return null;

  const inventoryAccountId = await resolveAccountId(input.companyId, INVENTORY_ACCOUNT_CODE);
  const adjustmentAccountId = await resolveAccountId(input.companyId, ADJUSTMENT_ACCOUNT_CODE);
  const magnitude = fromMinorUnits(netValueCents < 0n ? -netValueCents : netValueCents);
  const isShrinkage = netValueCents < 0n;

  const journal = await postJournalTx(
    tx,
    {
      companyId: input.companyId,
      entryDate: input.opnameDate,
      description: `Penyesuaian stok opname ${docNumber}`,
      sourceType: JOURNAL_SOURCE.INVENTORY,
      sourceId: opnameId,
      lines: isShrinkage
        ? [
            { accountId: adjustmentAccountId, debit: magnitude, credit: '0.00' },
            { accountId: inventoryAccountId, debit: '0.00', credit: magnitude },
          ]
        : [
            { accountId: inventoryAccountId, debit: magnitude, credit: '0.00' },
            { accountId: adjustmentAccountId, debit: '0.00', credit: magnitude },
          ],
    },
    input.userId,
  );
  return journal.id;
}

export function listOpnames(companyId: string, warehouseId?: string) {
  return repo.listOpnames(companyId, warehouseId);
}
