import { fromMinorUnits, sumMinorUnits, toMinorUnits } from '../../core/money.ts';
import { listAccounts, listPostedLines } from './finance.repository.ts';
import type { AccountType } from './finance.types.ts';

export interface TrialBalanceLine {
  readonly accountId: string;
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly debit: string;
  readonly credit: string;
  readonly balance: string;
}

export interface TrialBalanceReport {
  readonly lines: readonly TrialBalanceLine[];
  readonly totalDebit: string;
  readonly totalCredit: string;
  readonly balanced: boolean;
}

export async function trialBalance(companyId: string): Promise<TrialBalanceReport> {
  const [accounts, postedLines] = await Promise.all([listAccounts(companyId), listPostedLines(companyId)]);

  const debitByAccount = new Map<string, bigint>();
  const creditByAccount = new Map<string, bigint>();
  for (const line of postedLines) {
    debitByAccount.set(line.accountId, (debitByAccount.get(line.accountId) ?? 0n) + toMinorUnits(line.debit));
    creditByAccount.set(line.accountId, (creditByAccount.get(line.accountId) ?? 0n) + toMinorUnits(line.credit));
  }

  const lines: TrialBalanceLine[] = accounts.map((account) => {
    const debit = debitByAccount.get(account.id) ?? 0n;
    const credit = creditByAccount.get(account.id) ?? 0n;
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type as AccountType,
      debit: fromMinorUnits(debit),
      credit: fromMinorUnits(credit),
      balance: fromMinorUnits(debit - credit),
    };
  });

  const totalDebit = sumMinorUnits(lines.map((line) => line.debit));
  const totalCredit = sumMinorUnits(lines.map((line) => line.credit));

  return {
    lines,
    totalDebit: fromMinorUnits(totalDebit),
    totalCredit: fromMinorUnits(totalCredit),
    balanced: totalDebit === totalCredit,
  };
}

export interface BalanceSheetReport {
  readonly assets: string;
  readonly liabilities: string;
  readonly equity: string;
  readonly currentEarnings: string;
  readonly balanced: boolean;
}

export async function balanceSheet(companyId: string): Promise<BalanceSheetReport> {
  const report = await trialBalance(companyId);
  const sumByType = (type: AccountType): bigint =>
    sumMinorUnits(report.lines.filter((line) => line.type === type).map((line) => line.balance));

  const assets = sumByType('ASSET');
  const liabilities = -sumByType('LIABILITY');
  const equityAccounts = -sumByType('EQUITY');
  // Current-period earnings (revenue - expense) close into equity until period close is implemented.
  const currentEarnings = -sumByType('REVENUE') - sumByType('EXPENSE');
  const equity = equityAccounts + currentEarnings;

  return {
    assets: fromMinorUnits(assets),
    liabilities: fromMinorUnits(liabilities),
    equity: fromMinorUnits(equity),
    currentEarnings: fromMinorUnits(currentEarnings),
    balanced: assets === liabilities + equity,
  };
}

export interface ProfitLossReport {
  readonly revenue: string;
  readonly expense: string;
  readonly netProfit: string;
}

export async function profitAndLoss(companyId: string): Promise<ProfitLossReport> {
  const report = await trialBalance(companyId);
  const sumByType = (type: AccountType): bigint =>
    sumMinorUnits(report.lines.filter((line) => line.type === type).map((line) => line.balance));

  const revenue = -sumByType('REVENUE');
  const expense = sumByType('EXPENSE');

  return {
    revenue: fromMinorUnits(revenue),
    expense: fromMinorUnits(expense),
    netProfit: fromMinorUnits(revenue - expense),
  };
}
