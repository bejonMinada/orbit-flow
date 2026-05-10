import { getDb } from '../db/database';
import { formatAmount, normalizeCurrencyCode } from '../data/currencies';
import { LendingPayment, LendingRequest, LendingStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { computeLendingBreakdown } from '../utils/lending';

// Rounding tolerance for floating-point math when deciding if a loan is fully settled.
const SETTLEMENT_THRESHOLD = 0.009;

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function generateTransactionCode(): string {
  const raw = uuidv4().replace(/-/g, '').toUpperCase();
  return raw.slice(0, 12);
}

function getLendingEntryNote(kind: 'cash_in' | 'cash_out', borrowerName: string, transactionCode: string, referenceNumber: string): string {
  const action = kind === 'cash_out' ? 'Loan released to' : 'Loan repayment from';
  const ref = referenceNumber ? ` Ref: ${referenceNumber}` : '';
  return `${action} ${borrowerName} (TXN: ${transactionCode})${ref}`;
}

type LendingRow = {
  id: string;
  ledger_id: string;
  borrower_user_id: string;
  borrower_name: string;
  amount: number;
  currency: string;
  transaction_code: string;
  reference_number: string;
  interest_rate: number;
  term_months: number;
  due_date: string | null;
  penalty_rate: number;
  approved_at: string | null;
  proof_image_uri: string | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type LendingPaymentRow = {
  id: string;
  lending_request_id: string;
  amount_paid: number;
  applied_principal: number;
  applied_interest: number;
  applied_penalty: number;
  cashback_amount: number;
  note: string | null;
  paid_at: string;
  created_at: string;
};

function mapLendingRequest(row: LendingRow): LendingRequest {
  return {
    id: row.id,
    ledgerId: row.ledger_id,
    borrowerUserId: row.borrower_user_id,
    borrowerName: row.borrower_name,
    amount: row.amount,
    currency: row.currency,
    transactionCode: row.transaction_code ?? '',
    referenceNumber: row.reference_number,
    interestRate: row.interest_rate ?? 0,
    termMonths: row.term_months ?? 1,
    dueDate: row.due_date ?? undefined,
    penaltyRate: row.penalty_rate ?? 0,
    approvedAt: row.approved_at ?? undefined,
    proofImageUri: row.proof_image_uri ?? undefined,
    status: row.status as LendingStatus,
    note: row.note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLendingPayment(row: LendingPaymentRow): LendingPayment {
  return {
    id: row.id,
    lendingRequestId: row.lending_request_id,
    amountPaid: row.amount_paid,
    appliedPrincipal: row.applied_principal ?? 0,
    appliedInterest: row.applied_interest ?? 0,
    appliedPenalty: row.applied_penalty ?? 0,
    cashbackAmount: row.cashback_amount ?? 0,
    note: row.note ?? undefined,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

async function getLendingRequestById(id: string): Promise<LendingRequest | null> {
  const db = getDb();
  const row = await db.getFirstAsync<LendingRow>('SELECT * FROM lending_requests WHERE id = ? LIMIT 1', [id]);
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

function validateTermMonths(termMonths: number): number {
  if (!Number.isFinite(termMonths) || termMonths < 1) {
    throw new Error('Please enter a valid repayment term in months (minimum 1).');
  }
  return Math.floor(termMonths);
}

export async function getLendingRequests(): Promise<LendingRequest[]> {
  const db = getDb();
  const rows = await db.getAllAsync<LendingRow>('SELECT * FROM lending_requests ORDER BY created_at DESC');
  return rows.map(mapLendingRequest);
}

export async function getLendingPayments(lendingRequestId: string): Promise<LendingPayment[]> {
  const db = getDb();
  const rows = await db.getAllAsync<LendingPaymentRow>(
    'SELECT * FROM lending_payments WHERE lending_request_id = ? ORDER BY paid_at DESC',
    [lendingRequestId]
  );
  return rows.map(mapLendingPayment);
}

export async function createLendingRequest(
  ledgerId: string,
  borrowerName: string,
  amount: number,
  currency: string,
  interestRate: number,
  termMonths: number,
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
  const safeTermMonths = validateTermMonths(termMonths);
  await ensureLendableBalance(ledgerId, amount, safeCurrency);

  const now = new Date().toISOString();
  const id = newId('lr');
  const transactionCode = generateTransactionCode();

  await db.runAsync(
    `INSERT INTO lending_requests
      (id, ledger_id, borrower_user_id, borrower_name, amount, currency,
       transaction_code, reference_number, interest_rate, term_months, due_date, penalty_rate, approved_at,
       proof_image_uri, status, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      ledgerId,
      'local',
      borrowerName,
      amount,
      safeCurrency,
      transactionCode,
      '',
      interestRate,
      safeTermMonths,
      dueDate ?? null,
      penaltyRate,
      null,
      proofImageUri ?? null,
      'pending_admin_approval',
      note ?? null,
      now,
      now,
    ]
  );

  return {
    id,
    ledgerId,
    borrowerUserId: 'local',
    borrowerName,
    amount,
    currency: safeCurrency,
    transactionCode,
    referenceNumber: '',
    interestRate,
    termMonths: safeTermMonths,
    dueDate,
    penaltyRate,
    approvedAt: undefined,
    proofImageUri,
    status: 'pending_admin_approval',
    note,
    createdAt: now,
    updatedAt: now,
  };
}

export async function recordLendingPayment(
  lendingRequestId: string,
  amountPaid: number,
  referenceNumber?: string,
  note?: string
): Promise<void> {
  const db = getDb();
  const request = await getLendingRequestById(lendingRequestId);
  if (!request) throw new Error('Lending request not found.');
  if (request.status !== 'approved') throw new Error('Only approved requests can receive payments.');
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) throw new Error('Please enter a valid payment amount.');

  const payments = await getLendingPayments(lendingRequestId);
  const breakdown = computeLendingBreakdown(request, payments);
  if (breakdown.outstanding <= 0) throw new Error('This lending request is already fully paid.');

  const paymentAmount = Math.min(amountPaid, breakdown.outstanding);
  const principalAllocation = Math.min(paymentAmount, breakdown.principalRemaining);
  const afterPrincipal = paymentAmount - principalAllocation;
  const interestAllocation = Math.min(afterPrincipal, breakdown.accruedInterest);
  const afterInterest = afterPrincipal - interestAllocation;
  const penaltyAllocation = Math.min(afterInterest, breakdown.penalties);

  let cashbackAllocation = 0;
  const isEarlyFullPrincipalPayment = principalAllocation >= breakdown.principalRemaining && breakdown.cashbackIfPaidInFull > 0;
  if (isEarlyFullPrincipalPayment) {
    cashbackAllocation = Math.min(breakdown.cashbackIfPaidInFull, breakdown.futureInterest);
  }

  const now = new Date().toISOString();
  const ref = referenceNumber?.trim() ?? '';
  const noteText = note?.trim() || null;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO lending_payments
        (id, lending_request_id, amount_paid, applied_principal, applied_interest, applied_penalty, cashback_amount, note, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId('lp'),
        lendingRequestId,
        paymentAmount,
        principalAllocation,
        interestAllocation,
        penaltyAllocation,
        cashbackAllocation,
        noteText,
        now,
        now,
      ]
    );

    await insertLedgerEntry(
      db,
      request.ledgerId,
      'cash_in',
      paymentAmount,
      request.currency,
      request.borrowerName,
      request.transactionCode,
      ref || request.referenceNumber,
      now
    );

    const updatedPayments = await getLendingPayments(lendingRequestId);
    const updatedBreakdown = computeLendingBreakdown(request, updatedPayments);
    const nextStatus: LendingStatus = updatedBreakdown.outstanding <= SETTLEMENT_THRESHOLD ? 'settled' : 'approved';
    await db.runAsync(
      'UPDATE lending_requests SET status = ?, reference_number = ?, updated_at = ? WHERE id = ?',
      [nextStatus, ref || request.referenceNumber, now, lendingRequestId]
    );
  });
}

export async function updateLendingStatus(id: string, status: LendingStatus, referenceNumber?: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const request = await getLendingRequestById(id);
  if (!request) throw new Error('Lending request not found.');
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
        'UPDATE lending_requests SET status = ?, approved_at = ?, updated_at = ? WHERE id = ?',
        [status, now, now, id]
      );
    });
    return;
  }

  if (status === 'settled') {
    if (request.status !== 'approved') {
      throw new Error('Only approved requests can be settled.');
    }
    const payments = await getLendingPayments(id);
    const breakdown = computeLendingBreakdown(request, payments);
    await recordLendingPayment(id, breakdown.outstanding, referenceNumber, 'Marked settled with full payment');
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

type LendingEditableFields = {
  borrowerName: string;
  interestRate: number;
  termMonths: number;
  dueDate?: string;
  penaltyRate: number;
  note?: string;
  referenceNumber?: string;
};

export async function updateLendingRequestDetails(
  id: string,
  updates: LendingEditableFields
): Promise<void> {
  const db = getDb();
  const request = await getLendingRequestById(id);
  if (!request) throw new Error('Lending request not found.');
  const safeTermMonths = validateTermMonths(updates.termMonths);
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE lending_requests
      SET borrower_name = ?, interest_rate = ?, term_months = ?, due_date = ?, penalty_rate = ?,
          note = ?, reference_number = ?, updated_at = ?
      WHERE id = ?`,
    [
      updates.borrowerName.trim(),
      updates.interestRate,
      safeTermMonths,
      updates.dueDate?.trim() || null,
      updates.penaltyRate,
      updates.note?.trim() || null,
      updates.referenceNumber?.trim() || request.referenceNumber,
      now,
      id,
    ]
  );
}
