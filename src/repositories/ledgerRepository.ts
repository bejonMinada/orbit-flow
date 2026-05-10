import { getDb } from '../db/database';
import { Ledger, Entry, EntryKind } from '../types';
import { normalizeCurrencyCode } from '../data/currencies';
import { getWorkspaceBaseCurrency } from './workspaceRepository';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Ledgers ─────────────────────────────────────────────────────────────────

export async function getLedgers(): Promise<Ledger[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; type: string; name: string; visibility: string;
    base_currency: string; created_at: string; updated_at: string;
  }>('SELECT * FROM ledgers ORDER BY created_at DESC');

  return rows.map((r) => ({
    id: r.id,
    type: r.type as Ledger['type'],
    name: r.name,
    visibility: r.visibility as Ledger['visibility'],
    baseCurrency: r.base_currency,
    members: [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createLedger(name: string, currency?: string): Promise<Ledger> {
  const db = getDb();
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ledgers WHERE LOWER(name) = LOWER(?)',
    [name]
  );
  if (existing && existing.count > 0) {
    throw new Error(`A ledger named "${name}" already exists. Please choose a different name.`);
  }
  const now = new Date().toISOString();
  const id = newId('l');
  const fallbackCurrency = await getWorkspaceBaseCurrency();
  const safeCurrency = normalizeCurrencyCode(currency ?? fallbackCurrency, fallbackCurrency);
  await db.runAsync(
    'INSERT INTO ledgers (id, type, name, visibility, base_currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, 'cash', name, 'private', safeCurrency, now, now]
  );
  return { id, type: 'cash', name, visibility: 'private', baseCurrency: safeCurrency, members: [], createdAt: now, updatedAt: now };
}

export async function deleteLedger(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM ledgers WHERE id = ?', [id]);
}

// ─── Entries ─────────────────────────────────────────────────────────────────

export async function getEntries(ledgerId: string): Promise<Entry[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; ledger_id: string; kind: string; amount: number;
    currency: string; category_id: string; note: string;
    occurred_at: string; created_by: string; created_at: string;
  }>(
    'SELECT * FROM entries WHERE ledger_id = ? ORDER BY occurred_at DESC',
    [ledgerId]
  );
  return rows.map((r) => ({
    id: r.id,
    ledgerId: r.ledger_id,
    kind: r.kind as EntryKind,
    amount: r.amount,
    currency: r.currency,
    categoryId: r.category_id,
    note: r.note,
    occurredAt: r.occurred_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }));
}

export async function createEntry(
  ledgerId: string,
  kind: EntryKind,
  amount: number,
  currency: string,
  categoryId: string,
  note: string,
  occurredAt?: string
): Promise<Entry> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = newId('e');
  const at = occurredAt ?? now;
  const safeCurrency = normalizeCurrencyCode(currency);
  await db.runAsync(
    'INSERT INTO entries (id, ledger_id, kind, amount, currency, category_id, note, occurred_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, ledgerId, kind, amount, safeCurrency, categoryId, note, at, 'local', now]
  );
  return { id, ledgerId, kind, amount, currency: safeCurrency, categoryId, note, occurredAt: at, createdBy: 'local', createdAt: now };
}

export async function deleteEntry(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

export async function getLedgerBalance(ledgerId: string, currency: string): Promise<number> {
  const db = getDb();
  const safeCurrency = normalizeCurrencyCode(currency);
  const inRow = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE ledger_id = ? AND kind = 'cash_in' AND currency = ?",
    [ledgerId, safeCurrency]
  );
  const outRow = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE ledger_id = ? AND kind = 'cash_out' AND currency = ?",
    [ledgerId, safeCurrency]
  );
  return (inRow?.total ?? 0) - (outRow?.total ?? 0);
}

export async function getDashboardChartData(currency: string = 'PHP'): Promise<{
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  incomeCategoryBreakdown: { categoryId: string; total: number }[];
  expenseCategoryBreakdown: { categoryId: string; total: number }[];
}> {
  const db = getDb();
  const safeCurrency = normalizeCurrencyCode(currency);
  const [incomeRow, expensesRow, incomeCategoryRows, expenseCategoryRows, checklistRow] = await Promise.all([
    db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE kind = 'cash_in' AND currency = ?",
      [safeCurrency]
    ),
    db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE kind = 'cash_out' AND currency = ?",
      [safeCurrency]
    ),
    db.getAllAsync<{ category_id: string; total: number }>(
      "SELECT category_id, COALESCE(SUM(amount), 0) as total FROM entries WHERE kind = 'cash_in' AND currency = ? GROUP BY category_id ORDER BY total DESC LIMIT 6",
      [safeCurrency]
    ),
    db.getAllAsync<{ category_id: string; total: number }>(
      "SELECT category_id, COALESCE(SUM(amount), 0) as total FROM entries WHERE kind = 'cash_out' AND currency = ? GROUP BY category_id ORDER BY total DESC LIMIT 6",
      [safeCurrency]
    ),
    db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(ssi.planned_quantity * ti.last_price), 0) as total
         FROM shopping_session_items ssi
         JOIN tracked_items ti ON ti.id = ssi.tracked_item_id
        WHERE ssi.status = 'purchased'`,
    ),
  ]);
  const totalIncome = incomeRow?.total ?? 0;
  const checklistExpenses = checklistRow?.total ?? 0;
  const totalExpenses = (expensesRow?.total ?? 0) + checklistExpenses;
  const mergedExpenseRows = [...expenseCategoryRows];
  if (checklistExpenses > 0) {
    const otherIdx = mergedExpenseRows.findIndex((row) => row.category_id === 'cat_other');
    if (otherIdx >= 0) {
      mergedExpenseRows[otherIdx] = {
        category_id: 'cat_other',
        total: mergedExpenseRows[otherIdx].total + checklistExpenses,
      };
    } else {
      mergedExpenseRows.push({ category_id: 'cat_other', total: checklistExpenses });
    }
    mergedExpenseRows.sort((a, b) => b.total - a.total);
  }
  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    incomeCategoryBreakdown: incomeCategoryRows.map((r) => ({ categoryId: r.category_id, total: r.total })),
    expenseCategoryBreakdown: mergedExpenseRows.slice(0, 6).map((r) => ({ categoryId: r.category_id, total: r.total })),
  };
}

export async function updateEntry(
  id: string,
  updates: Pick<Entry, 'kind' | 'amount' | 'categoryId' | 'note'>
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    'UPDATE entries SET kind = ?, amount = ?, category_id = ?, note = ? WHERE id = ?',
    [updates.kind, updates.amount, updates.categoryId, updates.note, id]
  );
}

export type TrendRange = 'daily' | 'weekly' | 'monthly' | 'annual';

export type NetTrendPoint = {
  label: string;
  netAmount: number;
  periodStart: string;
};

function toDateOnly(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = toDateOnly(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = toDateOnly(date);
  d.setDate(1);
  return d;
}

function startOfYear(date: Date): Date {
  const d = toDateOnly(date);
  d.setMonth(0, 1);
  return d;
}

function addPeriod(date: Date, range: TrendRange, step: number): Date {
  const d = new Date(date);
  if (range === 'daily') d.setDate(d.getDate() + step);
  if (range === 'weekly') d.setDate(d.getDate() + (step * 7));
  if (range === 'monthly') d.setMonth(d.getMonth() + step);
  if (range === 'annual') d.setFullYear(d.getFullYear() + step);
  return d;
}

function normalizePeriodStart(date: Date, range: TrendRange): Date {
  if (range === 'daily') return toDateOnly(date);
  if (range === 'weekly') return startOfWeek(date);
  if (range === 'monthly') return startOfMonth(date);
  return startOfYear(date);
}

function formatPeriodLabel(date: Date, range: TrendRange): string {
  if (range === 'daily') {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  if (range === 'weekly') {
    const end = new Date(date);
    end.setDate(end.getDate() + 6);
    return `${date.getMonth() + 1}/${date.getDate()}-${end.getMonth() + 1}/${end.getDate()}`;
  }
  if (range === 'monthly') {
    return date.toLocaleDateString('en-US', { month: 'short' });
  }
  return String(date.getFullYear());
}

function getBucketCount(range: TrendRange): number {
  if (range === 'daily') return 14;
  if (range === 'weekly') return 12;
  if (range === 'monthly') return 12;
  return 5;
}

export async function getNetTrendData(
  currency: string,
  range: TrendRange
): Promise<NetTrendPoint[]> {
  const db = getDb();
  const safeCurrency = normalizeCurrencyCode(currency);
  const now = toDateOnly(new Date());
  const bucketCount = getBucketCount(range);
  const currentStart = normalizePeriodStart(now, range);
  const firstBucketStart = addPeriod(currentStart, range, -(bucketCount - 1));

  const rows = await db.getAllAsync<{
    kind: EntryKind;
    amount: number;
    occurred_at: string;
  }>(
    'SELECT kind, amount, occurred_at FROM entries WHERE currency = ? AND occurred_at >= ? ORDER BY occurred_at ASC',
    [safeCurrency, firstBucketStart.toISOString()]
  );

  const totals = new Map<string, number>();
  for (let i = 0; i < bucketCount; i += 1) {
    const bucketStart = addPeriod(firstBucketStart, range, i);
    totals.set(normalizePeriodStart(bucketStart, range).toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const occurredAt = new Date(row.occurred_at);
    const bucketStart = normalizePeriodStart(occurredAt, range);
    const key = bucketStart.toISOString().slice(0, 10);
    if (!totals.has(key)) continue;
    const signed = row.kind === 'cash_in' ? row.amount : -row.amount;
    totals.set(key, (totals.get(key) ?? 0) + signed);
  }

  let runningTotal = 0;
  return Array.from(totals.entries()).map(([periodStart, netAmount]) => {
    runningTotal += netAmount;
    const d = new Date(periodStart);
    return {
      periodStart,
      netAmount: runningTotal,
      label: formatPeriodLabel(d, range),
    };
  });
}
