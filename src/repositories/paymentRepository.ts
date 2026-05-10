import { getDb } from '../db/database';
import { PaymentProfile, PaymentMethod } from '../types';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function getPaymentProfiles(): Promise<PaymentProfile[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; owner_user_id: string; method: string;
    qr_image_uri: string | null; account_hint: string; created_at: string;
  }>('SELECT * FROM payment_profiles ORDER BY created_at DESC');

  return rows.map((r) => ({
    id: r.id,
    ownerUserId: r.owner_user_id,
    method: r.method as PaymentMethod,
    qrImageUri: r.qr_image_uri ?? undefined,
    accountHint: r.account_hint,
    createdAt: r.created_at,
  }));
}

export async function createPaymentProfile(
  method: PaymentMethod,
  accountHint: string,
  qrImageUri?: string
): Promise<PaymentProfile> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = newId('pp');
  await db.runAsync(
    'INSERT INTO payment_profiles (id, owner_user_id, method, qr_image_uri, account_hint, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, 'local', method, qrImageUri ?? null, accountHint, now]
  );
  return { id, ownerUserId: 'local', method, qrImageUri, accountHint, createdAt: now };
}

export async function deletePaymentProfile(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM payment_profiles WHERE id = ?', [id]);
}
