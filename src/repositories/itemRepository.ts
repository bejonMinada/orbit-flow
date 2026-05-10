import { getDb } from '../db/database';
import { ItemTracker, TrackedItem, PriceRecord } from '../types';
import { normalizeCurrencyCode } from '../data/currencies';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function getItemTrackers(): Promise<ItemTracker[]> {
  const db = getDb();
  const trackers = await db.getAllAsync<{
    id: string; name: string; created_at: string;
  }>('SELECT * FROM item_trackers ORDER BY created_at DESC');

  const result: ItemTracker[] = [];
  for (const t of trackers) {
    const items = await getTrackedItems(t.id);
    result.push({ id: t.id, name: t.name, items, createdAt: t.created_at });
  }
  return result;
}

export async function createItemTracker(name: string): Promise<ItemTracker> {
  const db = getDb();
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM item_trackers WHERE LOWER(name) = LOWER(?)',
    [name]
  );
  if (existing && existing.count > 0) {
    throw new Error(`A tracker named "${name}" already exists. Please choose a different name.`);
  }
  const now = new Date().toISOString();
  const id = newId('it');
  await db.runAsync(
    'INSERT INTO item_trackers (id, name, created_at) VALUES (?, ?, ?)',
    [id, name, now]
  );
  return { id, name, items: [], createdAt: now };
}

export async function deleteItemTracker(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM item_trackers WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM tracked_items WHERE tracker_id = ?', [id]);
}

export async function getTrackedItems(trackerId: string): Promise<TrackedItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; tracker_id: string; name: string; barcode: string | null;
    unit: string; quantity: number; last_price: number;
    price_history: string; created_at: string; updated_at: string;
  }>('SELECT * FROM tracked_items WHERE tracker_id = ? ORDER BY name ASC', [trackerId]);

  return rows.map((r) => ({
    id: r.id,
    trackerId: r.tracker_id,
    name: r.name,
    barcode: r.barcode ?? undefined,
    unit: r.unit,
    quantity: r.quantity,
    lastPrice: r.last_price,
    priceHistory: JSON.parse(r.price_history) as PriceRecord[],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createTrackedItem(
  trackerId: string,
  name: string,
  unit: string,
  quantity: number,
  price: number,
  currency: string,
  barcode?: string
): Promise<TrackedItem> {
  const db = getDb();
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM tracked_items WHERE tracker_id = ? AND LOWER(name) = LOWER(?)',
    [trackerId, name]
  );
  if (existing && existing.count > 0) {
    throw new Error(`An item named "${name}" already exists in this tracker. Please choose a different name.`);
  }
  const now = new Date().toISOString();
  const id = newId('item');
  const safeCurrency = normalizeCurrencyCode(currency);
  const priceHistory: PriceRecord[] = [{ price, currency: safeCurrency, at: now }];
  await db.runAsync(
    'INSERT INTO tracked_items (id, tracker_id, name, barcode, unit, quantity, last_price, price_history, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, trackerId, name, barcode ?? null, unit, quantity, price, JSON.stringify(priceHistory), now, now]
  );
  return { id, trackerId, name, barcode, unit, quantity, lastPrice: price, priceHistory, createdAt: now, updatedAt: now };
}

export async function updateTrackedItemQuantity(id: string, quantity: number): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE tracked_items SET quantity = ?, updated_at = ? WHERE id = ?',
    [quantity, now, id]
  );
}

export async function findByBarcode(barcode: string): Promise<TrackedItem | null> {
  const db = getDb();
  const row = await db.getFirstAsync<{
    id: string; tracker_id: string; name: string; barcode: string | null;
    unit: string; quantity: number; last_price: number;
    price_history: string; created_at: string; updated_at: string;
  }>('SELECT * FROM tracked_items WHERE barcode = ? LIMIT 1', [barcode]);

  if (!row) return null;
  return {
    id: row.id,
    trackerId: row.tracker_id,
    name: row.name,
    barcode: row.barcode ?? undefined,
    unit: row.unit,
    quantity: row.quantity,
    lastPrice: row.last_price,
    priceHistory: JSON.parse(row.price_history) as PriceRecord[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
