import { getDb } from '../db/database';
import { BurnRateResult } from '../types';

export async function calcBurnRate(ledgerId: string, currency: string): Promise<BurnRateResult> {
  const db = getDb();

  // Balance
  const inRow = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE ledger_id = ? AND kind = 'cash_in' AND currency = ?",
    [ledgerId, currency]
  );
  const outRow = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE ledger_id = ? AND kind = 'cash_out' AND currency = ?",
    [ledgerId, currency]
  );
  const currentBalance = (inRow?.total ?? 0) - (outRow?.total ?? 0);

  // 30-day average daily spend
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const spendRow = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE ledger_id = ? AND kind = 'cash_out' AND currency = ? AND occurred_at >= ?",
    [ledgerId, currency, thirtyDaysAgo]
  );
  const totalSpend30 = spendRow?.total ?? 0;
  const avgDailySpend = totalSpend30 / 30;

  let projectedRunwayDays = 0;
  let projectedDepletionDate = '';
  if (avgDailySpend > 0) {
    projectedRunwayDays = Math.floor(currentBalance / avgDailySpend);
    const depletionDate = new Date(Date.now() + projectedRunwayDays * 86400000);
    projectedDepletionDate = depletionDate.toISOString().split('T')[0];
  }

  return { ledgerId, avgDailySpend, currentBalance, projectedRunwayDays, projectedDepletionDate, currency };
}
