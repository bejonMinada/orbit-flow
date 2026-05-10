import { getDb } from '../db/database';
import {
  ItemTracker, TrackedItem, PriceRecord, ShoppingSession, ShoppingSessionItem, ShoppingItemStatus,
} from '../types';
import { normalizeCurrencyCode } from '../data/currencies';
import { v4 as uuidv4 } from 'uuid';

function newId(prefix: string): string {
  const raw = uuidv4().replace(/-/g, '').slice(0, 10);
  return `${prefix}_${Date.now()}_${raw}`;
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

type ShoppingSessionRow = {
  id: string;
  tracker_id: string;
  title: string;
  created_at: string;
};

type ShoppingSessionItemRow = {
  id: string;
  session_id: string;
  tracked_item_id: string | null;
  item_name: string;
  unit: string;
  planned_quantity: number;
  status: string;
  alternative_item_name: string | null;
  updated_at: string;
};

function mapSession(row: ShoppingSessionRow): ShoppingSession {
  return {
    id: row.id,
    trackerId: row.tracker_id,
    title: row.title,
    createdAt: row.created_at,
  };
}

function mapSessionItem(row: ShoppingSessionItemRow): ShoppingSessionItem {
  return {
    id: row.id,
    sessionId: row.session_id,
    trackedItemId: row.tracked_item_id ?? undefined,
    itemName: row.item_name,
    unit: row.unit,
    plannedQuantity: row.planned_quantity,
    status: row.status as ShoppingItemStatus,
    alternativeItemName: row.alternative_item_name ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function getShoppingSessions(trackerId: string): Promise<ShoppingSession[]> {
  const db = getDb();
  const rows = await db.getAllAsync<ShoppingSessionRow>(
    'SELECT * FROM shopping_sessions WHERE tracker_id = ? ORDER BY created_at DESC',
    [trackerId]
  );
  return rows.map(mapSession);
}

export async function getShoppingSessionItems(sessionId: string): Promise<ShoppingSessionItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<ShoppingSessionItemRow>(
    'SELECT * FROM shopping_session_items WHERE session_id = ? ORDER BY item_name ASC',
    [sessionId]
  );
  return rows.map(mapSessionItem);
}

export async function createShoppingSession(trackerId: string, title?: string): Promise<ShoppingSession> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = newId('ss');
  const safeTitle = title?.trim() || `Checklist ${now.slice(0, 10)}`;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO shopping_sessions (id, tracker_id, title, created_at) VALUES (?, ?, ?, ?)',
      [id, trackerId, safeTitle, now]
    );
    const items = (await getTrackedItems(trackerId)).filter((item) => item.quantity > 0);
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO shopping_session_items
          (id, session_id, tracked_item_id, item_name, unit, planned_quantity, status, alternative_item_name, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId('ssi'),
          id,
          item.id,
          item.name,
          item.unit,
          item.quantity,
          'pending',
          null,
          now,
        ]
      );
    }
  });

  return { id, trackerId, title: safeTitle, createdAt: now };
}

export async function updateShoppingSessionItem(
  sessionItemId: string,
  status: ShoppingItemStatus,
  alternativeItemName?: string
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE shopping_session_items SET status = ?, alternative_item_name = ?, updated_at = ? WHERE id = ?',
    [status, alternativeItemName?.trim() || null, now, sessionItemId]
  );
}
