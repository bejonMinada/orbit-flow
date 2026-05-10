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
