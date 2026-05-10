import { getDb } from '../db/database';
import { formatAmount, normalizeCurrencyCode } from '../data/currencies';
import { LendingRequest, LendingStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function generateTransactionCode(): string {
  // Uses UUID v4 entropy; App.tsx initializes react-native-get-random-values for RN compatibility.
  const raw = uuidv4().replace(/-/g, '').toUpperCase();
  return raw.slice(0, 12);
}

function getLendingEntryNote(kind: 'cash_in' | 'cash_out', borrowerName: string, transactionCode: string, referenceNumber: string): string {
  const action = kind === 'cash_out' ? 'Loan released to' : 'Loan settled by';
  const ref = referenceNumber ? ` Ref: ${referenceNumber}` : '';
  return `${action} ${borrowerName} (TXN: ${transactionCode})${ref}`;
}

type LendingRow = {
  id: string; ledger_id: string; borrower_user_id: string; borrower_name: string;
  amount: number; currency: string; transaction_code: string; reference_number: string;
  interest_rate: number; due_date: string | null; penalty_rate: number;
  proof_image_uri: string | null; status: string; note: string | null;
  created_at: string; updated_at: string;
};

function mapLendingRequest(r: LendingRow): LendingRequest {
  return {
    id: r.id,
    ledgerId: r.ledger_id,
    borrowerUserId: r.borrower_user_id,
    borrowerName: r.borrower_name,
    amount: r.amount,
    currency: r.currency,
    transactionCode: r.transaction_code ?? '',
    referenceNumber: r.reference_number,
    interestRate: r.interest_rate ?? 0,
    dueDate: r.due_date ?? undefined,
    penaltyRate: r.penalty_rate ?? 0,
    proofImageUri: r.proof_image_uri ?? undefined,
    status: r.status as LendingStatus,
    note: r.note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function getLendingRequestById(id: string): Promise<LendingRequest | null> {
  const db = getDb();
  const row = await db.getFirstAsync<LendingRow>(
    'SELECT * FROM lending_requests WHERE id = ? LIMIT 1', [id]
  );
  return row ? mapLendingRequest(row) : null;
}

async function getLedgerBalanceForCurrency(ledgerId: string, currency: string): Promise<number> {
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

async function insertLedgerEntry(
  db: ReturnType<typeof getDb>,
  ledgerId: string,
  kind: 'cash_in' | 'cash_out',
  amount: number,
  currency: string,
  borrowerName: string,
  transactionCode: string,
  referenceNumber: string,
  occurredAt: string
): Promise<void> {
  await db.runAsync(
    'INSERT INTO entries (id, ledger_id, kind, amount, currency, category_id, note, occurred_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      newId('e'),
      ledgerId,
      kind,
      amount,
      currency,
      'cat_lending',
      getLendingEntryNote(kind, borrowerName, transactionCode, referenceNumber),
      occurredAt,
      'local',
      occurredAt,
    ]
  );
}

async function ensureLendableBalance(ledgerId: string, amount: number, currency: string): Promise<void> {
  const balance = await getLedgerBalanceForCurrency(ledgerId, currency);
  if (amount > balance) {
    throw new Error(`Insufficient balance. The selected ledger has ${formatAmount(balance, currency)} available, but ${formatAmount(amount, currency)} is required.`);
  }
}

export async function getLendingRequests(): Promise<LendingRequest[]> {
  const db = getDb();
  const rows = await db.getAllAsync<LendingRow>(
    'SELECT * FROM lending_requests ORDER BY created_at DESC'
  );
  return rows.map(mapLendingRequest);
}

export async function createLendingRequest(
  ledgerId: string,
  borrowerName: string,
  amount: number,
  currency: string,
  interestRate: number,
  dueDate: string | undefined,
  penaltyRate: number,
  proofImageUri?: string,
  note?: string
): Promise<LendingRequest> {
  const db = getDb();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Please enter a valid lending amount greater than zero.');
  }

  const safeCurrency = normalizeCurrencyCode(currency);
  await ensureLendableBalance(ledgerId, amount, safeCurrency);

  const now = new Date().toISOString();
  const id = newId('lr');
  const transactionCode = generateTransactionCode();

  await db.runAsync(
    `INSERT INTO lending_requests
      (id, ledger_id, borrower_user_id, borrower_name, amount, currency,
       transaction_code, reference_number, interest_rate, due_date, penalty_rate,
       proof_image_uri, status, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
     [id, ledgerId, 'local', borrowerName, amount, safeCurrency,
      transactionCode, '', interestRate, dueDate ?? null, penaltyRate,
      proofImageUri ?? null, 'pending_admin_approval', note ?? null, now, now]
  );
  return {
    id, ledgerId, borrowerUserId: 'local', borrowerName,
    amount, currency: safeCurrency, transactionCode, referenceNumber: '',
    interestRate, dueDate, penaltyRate,
    proofImageUri, status: 'pending_admin_approval', note,
    createdAt: now, updatedAt: now,
  };
}

export async function updateLendingStatus(id: string, status: LendingStatus, referenceNumber?: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const request = await getLendingRequestById(id);
  if (!request) {
    throw new Error('Lending request not found.');
  }

  if (request.status === status) return;

  if (status === 'approved') {
    if (request.status !== 'pending_admin_approval') {
      throw new Error('Only pending requests can be approved.');
    }

    await ensureLendableBalance(request.ledgerId, request.amount, request.currency);
    await db.withTransactionAsync(async () => {
      await insertLedgerEntry(
        db,
        request.ledgerId,
        'cash_out',
        request.amount,
        request.currency,
        request.borrowerName,
        request.transactionCode,
        request.referenceNumber,
        now
      );
      await db.runAsync(
        'UPDATE lending_requests SET status = ?, updated_at = ? WHERE id = ?',
        [status, now, id]
      );
    });
    return;
  }

  if (status === 'settled') {
    if (request.status !== 'approved') {
      throw new Error('Only approved requests can be settled.');
    }

    const ref = referenceNumber?.trim() ?? '';
    await db.withTransactionAsync(async () => {
      await insertLedgerEntry(
        db,
        request.ledgerId,
        'cash_in',
        request.amount,
        request.currency,
        request.borrowerName,
        request.transactionCode,
        ref,
        now
      );
      await db.runAsync(
        'UPDATE lending_requests SET status = ?, reference_number = ?, updated_at = ? WHERE id = ?',
        [status, ref, now, id]
      );
    });
    return;
  }

  if (status === 'declined' && request.status !== 'pending_admin_approval') {
    throw new Error('Only pending requests can be declined.');
  }

  await db.runAsync(
    'UPDATE lending_requests SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, id]
  );
}
