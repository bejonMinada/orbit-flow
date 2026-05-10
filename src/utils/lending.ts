import { formatAmount } from '../data/currencies';
import { LendingRequest } from '../types';

export type LendingMetrics = {
  pendingCount: number;
  approvedCount: number;
  settledCount: number;
  outstandingAmount: number;
};

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
