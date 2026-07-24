import { ReportApprovalGatePolicy, type ReportApprovalGateItem } from './report-approval-gate.policy';

describe('ReportApprovalGatePolicy', () => {
  it('blocks unresolved critical review and evidence quality failures', () => {
    const result = ReportApprovalGatePolicy.evaluate([
      insight('i1', 'REVIEW_REQUIRED', 'NEEDS_REVIEW', true),
      insight('i2', 'CONFLICTING_EVIDENCE', 'NEEDS_REVIEW', true),
      insight('i3', 'MISSING_EVIDENCE', 'CONFIRMED', true),
    ]);

    expect(result.canApprove).toBe(false);
    expect(result.blockingReasons).toEqual([
      'REVIEW_REQUIRED_ITEMS',
      'HIGH_RISK_INSIGHT_UNREVIEWED',
      'CONFLICTING_EVIDENCE_UNREVIEWED',
      'CRITICAL_MISSING_EVIDENCE',
    ]);
    expect(result.blockingItems).toHaveLength(5);
  });

  it('allows non-critical unreviewed items to remain governed by acknowledgement policy', () => {
    const result = ReportApprovalGatePolicy.evaluate([
      insight('qa1', 'MISSING_EVIDENCE', 'NEEDS_REVIEW', false),
    ]);

    expect(result).toEqual({
      canApprove: true,
      blockingReasons: [],
      blockingItems: [],
    });
  });

  it('allows critical missing evidence when the item was rejected by review', () => {
    const result = ReportApprovalGatePolicy.evaluate([
      insight('i1', 'MISSING_EVIDENCE', 'REJECTED', true),
      link('l1', 'MISSING_EVIDENCE', 'REJECTED', true),
    ]);

    expect(result.canApprove).toBe(true);
  });

  it('does not block reviewed conflicting evidence', () => {
    const result = ReportApprovalGatePolicy.evaluate([
      insight('i1', 'CONFLICTING_EVIDENCE', 'CONFIRMED', true),
      link('l1', 'CONFLICTING_EVIDENCE', 'NEEDS_MORE_EVIDENCE', true),
    ]);

    expect(result.canApprove).toBe(true);
  });

  it('blocks finalization when an INFERRED link has no reviewer decision', () => {
    const result = ReportApprovalGatePolicy.evaluate([
      inferredLink('l-inf-1', 'INFERRED_FROM_STRUCTURE', 'NEEDS_REVIEW'),
    ]);

    expect(result.canApprove).toBe(false);
    expect(result.blockingReasons).toContain('INFERRED_LINKS_UNREVIEWED');
  });

  it('unblocks finalization when an INFERRED link is ACCEPTED by a reviewer', () => {
    const result = ReportApprovalGatePolicy.evaluate([
      inferredLink('l-inf-2', 'INFERRED_FROM_STRUCTURE', 'CONFIRMED', 'ACCEPTED'),
    ]);

    expect(result.canApprove).toBe(true);
    expect(result.blockingReasons).not.toContain('INFERRED_LINKS_UNREVIEWED');
  });

  it('unblocks finalization when an INFERRED link is REJECTED by a reviewer', () => {
    const result = ReportApprovalGatePolicy.evaluate([
      inferredLink('l-inf-3', 'MISSING_EVIDENCE', 'CONFIRMED', 'REJECTED'),
    ]);

    expect(result.canApprove).toBe(true);
    expect(result.blockingReasons).not.toContain('INFERRED_LINKS_UNREVIEWED');
  });

  it('does not unblock finalization when INFERRED link decision is only NEEDS_MORE_EVIDENCE', () => {
    // Reviewer must commit to ACCEPTED or REJECTED — NEEDS_MORE_EVIDENCE is
    // not a durable direction and must not be used to bypass the INFERRED gate.
    const result = ReportApprovalGatePolicy.evaluate([
      inferredLink('l-inf-4', 'INFERRED_FROM_STRUCTURE', 'NEEDS_REVIEW', 'NEEDS_MORE_EVIDENCE'),
    ]);

    expect(result.canApprove).toBe(false);
    expect(result.blockingReasons).toContain('INFERRED_LINKS_UNREVIEWED');
  });
});


function insight(
  id: string,
  quality: ReportApprovalGateItem['quality'],
  reviewStatus: string,
  isCritical: boolean,
): ReportApprovalGateItem {
  return {
    itemType: 'INSIGHT',
    itemId: id,
    insightId: id,
    artifact: `Insight ${id}`,
    quality,
    reasons: [],
    reviewStatus,
    reviewDecision: null,
    isCritical,
  };
}

function link(
  id: string,
  quality: ReportApprovalGateItem['quality'],
  decision: string,
  isCritical: boolean,
): ReportApprovalGateItem {
  return {
    itemType: 'TRACEABILITY_LINK',
    itemId: id,
    linkId: id,
    artifact: `src/${id}.ts`,
    quality,
    reasons: [],
    reviewStatus: 'NEEDS_REVIEW',
    reviewDecision: {
      decision,
    },
    isCritical,
  };
}

/**
 * Fixture for an INFERRED traceability link — semantically matched, not
 * directly proven by lexical evidence. reviewerDecision is null by default
 * (no reviewer has decided yet) and can be overridden with ACCEPTED/REJECTED.
 */
function inferredLink(
  id: string,
  quality: ReportApprovalGateItem['quality'],
  reviewStatus: string,
  decision?: string,
): ReportApprovalGateItem {
  return {
    itemType: 'TRACEABILITY_LINK',
    itemId: id,
    linkId: id,
    artifact: `src/${id}.ts`,
    quality,
    reasons: ['inferredLinkBasis'],
    reviewStatus,
    reviewDecision: decision ? { decision } : null,
    isCritical: false,
    isInferred: true,
  };
}
