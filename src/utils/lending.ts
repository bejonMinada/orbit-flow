import { formatAmount } from '../data/currencies';
import { LendingPayment, LendingRequest } from '../types';

export type LendingMetrics = {
  pendingCount: number;
  approvedCount: number;
  settledCount: number;
  outstandingAmount: number;
};

export type InstallmentStatus = 'paid' | 'due' | 'overdue' | 'upcoming';

export interface LendingInstallment {
  month: number;
  dueDate: string;
  targetAmount: number;
  paidAmount: number;
  penaltyAmount: number;
  status: InstallmentStatus;
}

export interface LendingBreakdown {
  monthlyDue: number;
  monthlyInterest: number;
  principalRemaining: number;
  accruedInterest: number;
  futureInterest: number;
  penalties: number;
  totalPaid: number;
  outstanding: number;
  cashbackIfPaidInFull: number;
  remainingMonths: number;
  installments: LendingInstallment[];
}

function clampTermMonths(termMonths: number): number {
  if (!Number.isFinite(termMonths) || termMonths < 1) return 1;
  return Math.floor(termMonths);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDayDiff(start: Date, end: Date): number {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

function getElapsedCalendarMonths(start: Date, end: Date): number {
  if (end <= start) return 0;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

function getLoanStartDate(request: LendingRequest): Date {
  return new Date(request.approvedAt ?? request.createdAt);
}

function getFirstDueDate(request: LendingRequest): Date {
  if (request.dueDate) return new Date(request.dueDate);
  return addMonths(getLoanStartDate(request), 1);
}

function getTotalPaid(payments: LendingPayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amountPaid, 0);
}

function getPrincipalPaid(payments: LendingPayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.appliedPrincipal, 0);
}

function getInterestPaid(payments: LendingPayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.appliedInterest + payment.cashbackAmount, 0);
}

function getPenaltyPaid(payments: LendingPayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.appliedPenalty, 0);
}

export function computeLendingBreakdown(
  request: LendingRequest,
  payments: LendingPayment[],
  asOf: Date = new Date()
): LendingBreakdown {
  const termMonths = clampTermMonths(request.termMonths);
  const monthlyInterest = request.amount * (request.interestRate / 100);
  const totalInterest = monthlyInterest * termMonths;
  const monthlyDue = (request.amount + totalInterest) / termMonths;
  const totalPaid = getTotalPaid(payments);
  const principalPaid = getPrincipalPaid(payments);
  const interestPaid = getInterestPaid(payments);
  const penaltyPaid = getPenaltyPaid(payments);

  const principalRemaining = Math.max(0, request.amount - principalPaid);
  const start = getLoanStartDate(request);
  const firstDue = getFirstDueDate(request);
  const elapsedMonthsRaw = getElapsedCalendarMonths(start, asOf);
  const elapsedMonths = Math.min(termMonths, Math.max(0, elapsedMonthsRaw));
  const accruedInterestGross = monthlyInterest * elapsedMonths;
  const accruedInterest = Math.max(0, accruedInterestGross - interestPaid);
  const futureInterest = Math.max(0, totalInterest - accruedInterestGross);

  const installments: LendingInstallment[] = [];
  let expectedPaidCumulative = 0;
  for (let i = 0; i < termMonths; i += 1) {
    const dueDate = addMonths(firstDue, i);
    expectedPaidCumulative += monthlyDue;
    const paidTowardsThisInstallment = Math.max(0, Math.min(monthlyDue, totalPaid - (expectedPaidCumulative - monthlyDue)));
    const unpaidInstallment = Math.max(0, monthlyDue - paidTowardsThisInstallment);
    const overdueDays = getDayDiff(dueDate, asOf);
    const penaltyAmount = overdueDays > 0 && unpaidInstallment > 0
      ? unpaidInstallment * (request.penaltyRate / 100) * overdueDays
      : 0;
    const status: InstallmentStatus =
      paidTowardsThisInstallment >= monthlyDue
        ? 'paid'
        : overdueDays > 0
          ? 'overdue'
          : getDayDiff(asOf, dueDate) > 0
            ? 'upcoming'
            : 'due';

    installments.push({
      month: i + 1,
      dueDate: toDateString(dueDate),
      targetAmount: monthlyDue,
      paidAmount: paidTowardsThisInstallment,
      penaltyAmount,
      status,
    });
  }

  const penaltiesGross = installments.reduce((sum, installment) => sum + installment.penaltyAmount, 0);
  const penalties = Math.max(0, penaltiesGross - penaltyPaid);
  const cashbackIfPaidInFull = principalRemaining > 0 ? futureInterest : 0;
  const outstanding = Math.max(0, principalRemaining + accruedInterest + futureInterest + penalties);
  const remainingMonths = Math.max(0, termMonths - elapsedMonths);

  return {
    monthlyDue,
    monthlyInterest,
    principalRemaining,
    accruedInterest,
    futureInterest,
    penalties,
    totalPaid,
    outstanding,
    cashbackIfPaidInFull,
    remainingMonths,
    installments,
  };
}

export function getLendingMetrics(requests: LendingRequest[]): LendingMetrics {
  return requests.reduce<LendingMetrics>((summary, request) => {
    if (request.status === 'pending_admin_approval') {
      summary.pendingCount += 1;
    }

    if (request.status === 'approved') {
      summary.approvedCount += 1;
      summary.outstandingAmount += request.amount;
    }

    if (request.status === 'settled') {
      summary.settledCount += 1;
    }

    return summary;
  }, {
    pendingCount: 0,
    approvedCount: 0,
    settledCount: 0,
    outstandingAmount: 0,
  });
}

export function formatLendingOutstanding(requests: LendingRequest[]): string {
  const totals = requests.reduce<Record<string, number>>((summary, request) => {
    if (request.status !== 'approved') return summary;
    summary[request.currency] = (summary[request.currency] ?? 0) + request.amount;
    return summary;
  }, {});

  const entries = Object.entries(totals);
  if (entries.length === 0) return 'No active loans';

  return entries
    .map(([currency, amount]) => formatAmount(amount, currency))
    .join(' · ');
}
