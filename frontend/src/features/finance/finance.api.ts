import { apiRequest } from '../../shared/lib/api-client.ts';

export interface Account {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: string;
  readonly normalBalance: string;
  readonly isActive: boolean;
}

export interface JournalLinePayload {
  readonly accountId: string;
  readonly debit: string;
  readonly credit: string;
  readonly description?: string;
}

export interface CreateJournalPayload {
  readonly entryDate: string;
  readonly description: string;
  readonly lines: readonly JournalLinePayload[];
}

export interface TrialBalanceLine {
  readonly accountId: string;
  readonly code: string;
  readonly name: string;
  readonly type: string;
  readonly debit: string;
  readonly credit: string;
  readonly balance: string;
}

export interface TrialBalance {
  readonly lines: readonly TrialBalanceLine[];
  readonly totalDebit: string;
  readonly totalCredit: string;
  readonly balanced: boolean;
}

export function listAccounts(): Promise<Account[]> {
  return apiRequest<Account[]>('/coa');
}

export function createAccount(payload: {
  code: string;
  name: string;
  type: string;
}): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/coa', { method: 'POST', body: payload });
}

export function createJournal(payload: CreateJournalPayload, idempotencyKey: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/finance/journals', { method: 'POST', body: payload, idempotencyKey });
}

export function getTrialBalance(): Promise<TrialBalance> {
  return apiRequest<TrialBalance>('/finance/reports/trial-balance');
}
