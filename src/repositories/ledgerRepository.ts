import { getDb } from '../db/database';
import { Ledger, Entry, EntryKind } from '../types';

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

export async function createLedger(name: string, currency: string = 'PHP'): Promise<Ledger> {
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
  await db.runAsync(
    'INSERT INTO ledgers (id, type, name, visibility, base_currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, 'cash', name, 'private', currency, now, now]
  );
  return { id, type: 'cash', name, visibility: 'private', baseCurrency: currency, members: [], createdAt: now, updatedAt: now };
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
  await db.runAsync(
    'INSERT INTO entries (id, ledger_id, kind, amount, currency, category_id, note, occurred_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, ledgerId, kind, amount, currency, categoryId, note, at, 'local', now]
  );
  return { id, ledgerId, kind, amount, currency, categoryId, note, occurredAt: at, createdBy: 'local', createdAt: now };
}

export async function deleteEntry(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

export async function getLedgerBalance(ledgerId: string, currency: string): Promise<number> {
  const db = getDb();
  const inRow = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE ledger_id = ? AND kind = 'cash_in' AND currency = ?",
    [ledgerId, currency]
  );
  const outRow = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE ledger_id = ? AND kind = 'cash_out' AND currency = ?",
    [ledgerId, currency]
  );
  return (inRow?.total ?? 0) - (outRow?.total ?? 0);
}

export async function getDashboardChartData(currency: string = 'PHP'): Promise<{
  totalIncome: number;
  totalExpenses: number;
  categoryBreakdown: { categoryId: string; total: number }[];
}> {
  const db = getDb();
  const [incomeRow, expensesRow, categoryRows] = await Promise.all([
    db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE kind = 'cash_in' AND currency = ?",
      [currency]
    ),
    db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE kind = 'cash_out' AND currency = ?",
      [currency]
    ),
    db.getAllAsync<{ category_id: string; total: number }>(
      "SELECT category_id, COALESCE(SUM(amount), 0) as total FROM entries WHERE kind = 'cash_out' AND currency = ? GROUP BY category_id ORDER BY total DESC LIMIT 6",
      [currency]
    ),
  ]);
  return {
    totalIncome: incomeRow?.total ?? 0,
    totalExpenses: expensesRow?.total ?? 0,
    categoryBreakdown: categoryRows.map((r) => ({ categoryId: r.category_id, total: r.total })),
  };
}
