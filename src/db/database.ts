import * as SQLite from 'expo-sqlite';
import { SYSTEM_CATEGORIES } from '../data/categories';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('orbitflow.db');
  }
  return _db;
}

export async function initDb(): Promise<void> {
  const db = getDb();

  await db.execAsync(`PRAGMA journal_mode = WAL;`);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_currency TEXT NOT NULL DEFAULT 'PHP',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledgers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'cash',
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      base_currency TEXT NOT NULL DEFAULT 'PHP',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledger_members (
      ledger_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      PRIMARY KEY (ledger_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      ledger_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      category_id TEXT NOT NULL DEFAULT 'cat_other',
      note TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'local',
      created_at TEXT NOT NULL,
      FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS item_trackers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracked_items (
      id TEXT PRIMARY KEY,
      tracker_id TEXT NOT NULL,
      name TEXT NOT NULL,
      barcode TEXT,
      unit TEXT NOT NULL DEFAULT 'pcs',
      quantity REAL NOT NULL DEFAULT 0,
      last_price REAL NOT NULL DEFAULT 0,
      price_history TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (tracker_id) REFERENCES item_trackers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lending_requests (
      id TEXT PRIMARY KEY,
      ledger_id TEXT NOT NULL,
      borrower_user_id TEXT NOT NULL,
      borrower_name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      reference_number TEXT NOT NULL DEFAULT '',
      proof_image_uri TEXT,
      status TEXT NOT NULL DEFAULT 'pending_admin_approval',
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_profiles (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL DEFAULT 'local',
      method TEXT NOT NULL,
      qr_image_uri TEXT,
      account_hint TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sinking_funds (
      id TEXT PRIMARY KEY,
      ledger_id TEXT NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      currency TEXT NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      deadline TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS op_log (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
  `);

  await seedCategories(db);
  await seedDefaultWorkspace(db);
}

async function seedCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories WHERE is_system = 1'
  );
  if (existing && existing.count > 0) return;

  for (const cat of SYSTEM_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (id, name, icon, color, is_system) VALUES (?, ?, ?, ?, ?)',
      [cat.id, cat.name, cat.icon, cat.color, 1]
    );
  }
}

async function seedDefaultWorkspace(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM workspaces'
  );
  if (existing && existing.count > 0) return;

  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO workspaces (id, name, base_currency, created_at) VALUES (?, ?, ?, ?)',
    ['ws_default', 'My OrbitFlow', 'PHP', now]
  );
}
