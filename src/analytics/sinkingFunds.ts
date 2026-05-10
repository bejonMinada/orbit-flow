import { getDb } from '../db/database';
import { SinkingFund, SinkingFundProgress, ContributionFrequency } from '../types';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function getSinkingFunds(): Promise<SinkingFund[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; ledger_id: string; name: string; target_amount: number;
    currency: string; current_amount: number; deadline: string;
    frequency: string; created_at: string;
  }>('SELECT * FROM sinking_funds ORDER BY deadline ASC');

  return rows.map((r) => ({
    id: r.id,
    ledgerId: r.ledger_id,
    name: r.name,
    targetAmount: r.target_amount,
    currency: r.currency,
    currentAmount: r.current_amount,
    deadline: r.deadline,
    frequency: r.frequency as ContributionFrequency,
    createdAt: r.created_at,
  }));
}

export async function createSinkingFund(
  ledgerId: string,
  name: string,
  targetAmount: number,
  currency: string,
  deadline: string,
  frequency: ContributionFrequency
): Promise<SinkingFund> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = newId('sf');
  await db.runAsync(
    'INSERT INTO sinking_funds (id, ledger_id, name, target_amount, currency, current_amount, deadline, frequency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, ledgerId, name, targetAmount, currency, 0, deadline, frequency, now]
  );
  return { id, ledgerId, name, targetAmount, currency, currentAmount: 0, deadline, frequency, createdAt: now };
}

export async function contributeToFund(id: string, amount: number): Promise<void> {
  const db = getDb();
  await db.runAsync(
    'UPDATE sinking_funds SET current_amount = current_amount + ? WHERE id = ?',
    [amount, id]
  );
}

export function calcFundProgress(fund: SinkingFund): SinkingFundProgress {
  const now = new Date();
  const deadline = new Date(fund.deadline);
  const msPerDay = 86400000;
  const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / msPerDay));
  const remaining = Math.max(0, fund.targetAmount - fund.currentAmount);

  let divisor = daysRemaining;
  if (fund.frequency === 'weekly') divisor = Math.ceil(daysRemaining / 7);
  else if (fund.frequency === 'monthly') divisor = Math.ceil(daysRemaining / 30);

  const requiredContribution = divisor > 0 ? remaining / divisor : remaining;
  const onTrack = fund.currentAmount >= fund.targetAmount * (1 - daysRemaining / 365);

  return { fund, daysRemaining, requiredContribution, onTrack };
}
