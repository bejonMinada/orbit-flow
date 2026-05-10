// ─── Workspace & Users ───────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  baseCurrency: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Member {
  userId: string;
  role: Role;
}

// ─── Cash Ledgers ────────────────────────────────────────────────────────────

export type LedgerType = 'cash' | 'shared';
export type LedgerVisibility = 'private' | 'shared';

export interface Ledger {
  id: string;
  type: LedgerType;
  name: string;
  visibility: LedgerVisibility;
  baseCurrency: string;
  members: Member[];
  createdAt: string;
  updatedAt: string;
}

// ─── Entries (Cash In / Cash Out) ────────────────────────────────────────────

export type EntryKind = 'cash_in' | 'cash_out';

export interface Entry {
  id: string;
  ledgerId: string;
  kind: EntryKind;
  amount: number;
  currency: string;
  categoryId: string;
  note: string;
  occurredAt: string;
  createdBy: string;
  createdAt: string;
}

// ─── Category ────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  isSystem: boolean;
}

// ─── Itemized Trackers ────────────────────────────────────────────────────────

export interface PriceRecord {
  price: number;
  currency: string;
  at: string;
}

export interface TrackedItem {
  id: string;
  trackerId: string;
  name: string;
  barcode?: string;
  unit: string;
  quantity: number;
  lastPrice: number;
  priceHistory: PriceRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ItemTracker {
  id: string;
  name: string;
  items: TrackedItem[];
  createdAt: string;
}

// ─── Credit & Settlement Monitor (Lending) ───────────────────────────────────

export type LendingStatus =
  | 'pending_admin_approval'
  | 'approved'
  | 'declined'
  | 'settled';

export interface LendingRequest {
  id: string;
  ledgerId: string;
  borrowerUserId: string;
  borrowerName: string;
  amount: number;
  currency: string;
  transactionCode: string;
  referenceNumber: string;
  interestRate: number;
  termMonths: number;
  dueDate?: string;
  penaltyRate: number;
  approvedAt?: string;
  proofImageUri?: string;
  status: LendingStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LendingPayment {
  id: string;
  lendingRequestId: string;
  amountPaid: number;
  appliedPrincipal: number;
  appliedInterest: number;
  appliedPenalty: number;
  cashbackAmount: number;
  note?: string;
  paidAt: string;
  createdAt: string;
}

// ─── Payment Profiles ────────────────────────────────────────────────────────

export type PaymentMethod =
  | 'gcash'
  | 'maya'
  | 'bank_transfer'
  | 'paypal'
  | 'cash'
  | 'other';

export interface PaymentProfile {
  id: string;
  ownerUserId: string;
  method: PaymentMethod;
  qrImageUri?: string;
  accountHint: string;
  createdAt: string;
}

// ─── Sinking Funds ───────────────────────────────────────────────────────────

export type ContributionFrequency = 'daily' | 'weekly' | 'monthly';

export interface SinkingFund {
  id: string;
  ledgerId: string;
  name: string;
  targetAmount: number;
  currency: string;
  currentAmount: number;
  deadline: string;
  frequency: ContributionFrequency;
  createdAt: string;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncState {
  lastSyncAt: string;
  opLogCursor: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface BurnRateResult {
  ledgerId: string;
  avgDailySpend: number;
  currentBalance: number;
  projectedRunwayDays: number;
  projectedDepletionDate: string;
  currency: string;
}

export interface SinkingFundProgress {
  fund: SinkingFund;
  daysRemaining: number;
  requiredContribution: number;
  onTrack: boolean;
}
