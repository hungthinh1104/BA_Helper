import type { EvidenceQualityItem } from "@ba-helper/backend-runtime";

export type ReportApprovalBlockerCode =
  | 'CONFLICTING_EVIDENCE_UNREVIEWED'
  | 'CRITICAL_MISSING_EVIDENCE'
  | 'REVIEW_REQUIRED_ITEMS'
  | 'HIGH_RISK_INSIGHT_UNREVIEWED'
  | 'INFERRED_LINKS_UNREVIEWED';

export type ReportApprovalGateItem = EvidenceQualityItem & {
  isCritical?: boolean;
  isInferred?: boolean;
};

export type ReportApprovalGateResult = {
  canApprove: boolean;
  blockingReasons: ReportApprovalBlockerCode[];
  blockingItems: Array<{
    code: ReportApprovalBlockerCode;
    itemType: 'TRACEABILITY_LINK' | 'INSIGHT';
    itemId: string;
    quality: string;
    artifact: string;
  }>;
};

export function buildReportApprovalGateItems(params: {
  items: EvidenceQualityItem[];
  insights: Array<{
    id: string;
    insightType: string;
    certainty: string;
  }>;
  traceabilityLinks: Array<{
    id: string;
    linkType: string;
    linkBasis: string;
  }>;
}): ReportApprovalGateItem[] {
  const criticalInsightIds = new Set(
    params.insights
      .filter((insight) => (
        insight.insightType === 'CLAIM' ||
        insight.certainty === 'CONFLICTING'
      ))
      .map((insight) => insight.id),
  );

  const criticalLinkIds = new Set(
    params.traceabilityLinks
      .filter((link) => link.linkType === 'AFFECTED' && link.linkBasis === 'EVIDENCED')
      .map((link) => link.id),
  );

  const inferredLinkIds = new Set(
    params.traceabilityLinks
      .filter((link) => link.linkType === 'AFFECTED' && link.linkBasis === 'INFERRED')
      .map((link) => link.id),
  );

  return params.items.map((item) => ({
    ...item,
    isCritical: item.itemType === 'INSIGHT'
      ? !!item.insightId && criticalInsightIds.has(item.insightId)
      : !!item.linkId && criticalLinkIds.has(item.linkId),
    isInferred: item.itemType === 'TRACEABILITY_LINK'
      ? !!item.linkId && inferredLinkIds.has(item.linkId)
      : false,
  }));
}

export class ReportApprovalGatePolicy {
  static evaluate(items: ReportApprovalGateItem[]): ReportApprovalGateResult {
    const blockingItems: ReportApprovalGateResult['blockingItems'] = [];

    for (const item of items) {
      if (item.isCritical && item.quality === 'REVIEW_REQUIRED') {
        blockingItems.push(toBlockingItem('REVIEW_REQUIRED_ITEMS', item));
      }

      if (item.quality === 'CONFLICTING_EVIDENCE' && !isReviewed(item)) {
        blockingItems.push(toBlockingItem('CONFLICTING_EVIDENCE_UNREVIEWED', item));
      }

      if (item.isCritical && item.quality === 'MISSING_EVIDENCE' && !isRejected(item)) {
        blockingItems.push(toBlockingItem('CRITICAL_MISSING_EVIDENCE', item));
      }

      if (
        item.isCritical &&
        item.itemType === 'INSIGHT' &&
        item.reviewStatus === 'NEEDS_REVIEW'
      ) {
        blockingItems.push(toBlockingItem('HIGH_RISK_INSIGHT_UNREVIEWED', item));
      }

      // INFERRED links that have not been reviewed by a human are a hard block:
      // semantic-only matches carry unverified risk and must be explicitly
      // confirmed or rejected before the analysis can be finalized.
      if (
        item.isInferred &&
        item.itemType === 'TRACEABILITY_LINK' &&
        !isLinkDecided(item)
      ) {
        blockingItems.push(toBlockingItem('INFERRED_LINKS_UNREVIEWED', item));
      }
    }

    const blockingReasons = Array.from(
      new Set(blockingItems.map((item) => item.code)),
    );

    return {
      canApprove: blockingReasons.length === 0,
      blockingReasons,
      blockingItems: dedupeBlockingItems(blockingItems),
    };
  }
}

function isReviewed(item: ReportApprovalGateItem): boolean {
  if (item.itemType === 'INSIGHT') {
    return item.reviewStatus === 'CONFIRMED' || item.reviewStatus === 'REJECTED';
  }

  const decision = readDecision(item);
  return (
    decision === 'ACCEPTED' ||
    decision === 'REJECTED' ||
    decision === 'NEEDS_REVIEW' ||
    decision === 'NEEDS_MORE_EVIDENCE'
  );
}

function isRejected(item: ReportApprovalGateItem): boolean {
  if (item.itemType === 'INSIGHT') {
    return item.reviewStatus === 'REJECTED';
  }
  return readDecision(item) === 'REJECTED';
}

/**
 * A traceability link is "decided" when a reviewer has explicitly accepted or
 * rejected it. NEEDS_MORE_EVIDENCE is intentionally excluded: for INFERRED
 * links the reviewer must commit to a durable direction (accept the semantic
 * match or reject it as a false positive) before the analysis is finalisable.
 */
function isLinkDecided(item: ReportApprovalGateItem): boolean {
  const decision = readDecision(item);
  return decision === 'ACCEPTED' || decision === 'REJECTED';
}

function readDecision(item: ReportApprovalGateItem): string | null {
  const decision = item.reviewDecision;
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    return null;
  }
  const value = (decision as { decision?: unknown }).decision;
  return typeof value === 'string' ? value : null;
}

function toBlockingItem(
  code: ReportApprovalBlockerCode,
  item: ReportApprovalGateItem,
): ReportApprovalGateResult['blockingItems'][number] {
  return {
    code,
    itemType: item.itemType,
    itemId: item.itemId,
    quality: item.quality,
    artifact: item.artifact,
  };
}

function dedupeBlockingItems(
  items: ReportApprovalGateResult['blockingItems'],
): ReportApprovalGateResult['blockingItems'] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.code}:${item.itemType}:${item.itemId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
