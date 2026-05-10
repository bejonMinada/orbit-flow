import { getDb } from '../db/database';
import { normalizeCurrencyCode } from '../data/currencies';

export async function getWorkspaceBaseCurrency(): Promise<string> {
  const db = getDb();
  const row = await db.getFirstAsync<{ base_currency: string }>(
    'SELECT base_currency FROM workspaces ORDER BY created_at ASC LIMIT 1'
  );
  return normalizeCurrencyCode(row?.base_currency ?? 'PHP');
}

export async function updateWorkspaceBaseCurrency(currency: string): Promise<string> {
  const db = getDb();
  const safeCurrency = normalizeCurrencyCode(currency);
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1'
  );
  if (!row) {
    throw new Error('Workspace not found.');
  }
  await db.runAsync('UPDATE workspaces SET base_currency = ? WHERE id = ?', [safeCurrency, row.id]);
  return safeCurrency;
}
