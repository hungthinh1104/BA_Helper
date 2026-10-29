import type { SubmitReviewItemDecisionResponse } from '@ba-helper/contracts';

export function mapImpactReviewDecision(
  itemId: string,
  decision: string,
  note: string | null,
  idempotent: boolean,
): SubmitReviewItemDecisionResponse {
  return {
    itemId,
    target: 'impact',
    currentDecision: toDecision(decision),
    reviewNote: note,
    idempotent,
  };
}

export function mapInsightReviewDecision(
  itemId: string,
  status: string,
  note: string | null,
  idempotent: boolean,
): SubmitReviewItemDecisionResponse {
  return {
    itemId,
    target: 'insight',
    currentDecision: toDecision(status),
    reviewNote: note,
    idempotent,
  };
}

function toDecision(
  value: string,
): SubmitReviewItemDecisionResponse['currentDecision'] {
  if (value === 'ACCEPTED' || value === 'CONFIRMED') return 'accepted';
  if (value === 'REJECTED') return 'rejected';
  if (value === 'NEEDS_MORE_EVIDENCE') return 'needs_more_evidence';
  return 'needs_review';
}
