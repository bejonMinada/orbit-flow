import { getDb } from '../db/database';
import { LendingRequest, LendingStatus } from '../types';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function getLendingRequests(): Promise<LendingRequest[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; ledger_id: string; borrower_user_id: string; borrower_name: string;
    amount: number; currency: string; reference_number: string;
    proof_image_uri: string | null; status: string; note: string | null;
    created_at: string; updated_at: string;
  }>('SELECT * FROM lending_requests ORDER BY created_at DESC');

  return rows.map((r) => ({
    id: r.id,
    ledgerId: r.ledger_id,
    borrowerUserId: r.borrower_user_id,
    borrowerName: r.borrower_name,
    amount: r.amount,
    currency: r.currency,
    referenceNumber: r.reference_number,
    proofImageUri: r.proof_image_uri ?? undefined,
    status: r.status as LendingStatus,
    note: r.note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createLendingRequest(
  ledgerId: string,
  borrowerName: string,
  amount: number,
  currency: string,
  referenceNumber: string,
  proofImageUri?: string,
  note?: string
): Promise<LendingRequest> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = newId('lr');
  await db.runAsync(
    `INSERT INTO lending_requests
      (id, ledger_id, borrower_user_id, borrower_name, amount, currency,
       reference_number, proof_image_uri, status, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ledgerId, 'local', borrowerName, amount, currency,
     referenceNumber, proofImageUri ?? null, 'pending_admin_approval', note ?? null, now, now]
  );
  return {
    id, ledgerId, borrowerUserId: 'local', borrowerName,
    amount, currency, referenceNumber,
    proofImageUri, status: 'pending_admin_approval', note,
    createdAt: now, updatedAt: now,
  };
}

export async function updateLendingStatus(id: string, status: LendingStatus): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE lending_requests SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, id]
  );
}
