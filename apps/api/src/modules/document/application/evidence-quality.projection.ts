import { EvidenceQualityAnnotator, EvidenceQualityItem, EvidenceQualitySummary, InsightForAnnotation, TraceabilityLinkForAnnotation } from "@ba-helper/backend-runtime";

export function buildEvidenceQualityProjection(params: {
  traceabilityLinks: TraceabilityLinkForAnnotation[];
  insights?: InsightForAnnotation[];
}): {
  summary: EvidenceQualitySummary;
  items: EvidenceQualityItem[];
} {
  const traceabilityItems = params.traceabilityLinks.map((link) => {
    const annotation = EvidenceQualityAnnotator.annotateTraceabilityLink(link);
    return {
      annotation,
      item: {
        itemType: 'TRACEABILITY_LINK' as const,
        itemId: link.id,
        linkId: link.id,
        artifact: link.artifact?.filePath || link.artifact?.name || 'Unknown',
        quality: annotation.label,
        reasons: annotation.reasons,
        reviewStatus: link.reviewStatus,
        reviewDecision: link.reviewDecision
          ? {
              id: link.reviewDecision.id,
              analysisId: link.reviewDecision.analysisId,
              traceabilityLinkId: link.reviewDecision.traceabilityLinkId,
              decision: link.reviewDecision.decision,
              note: link.reviewDecision.note,
              reviewedByUserId: link.reviewDecision.reviewedByUserId,
              reviewedAt: link.reviewDecision.reviewedAt.toISOString(),
            }
          : null,
      },
    };
  });

  const insightItems = (params.insights ?? []).map((insight) => {
    const annotation = EvidenceQualityAnnotator.annotateInsight(insight);
    return {
      annotation,
      item: {
        itemType: 'INSIGHT' as const,
        itemId: insight.id,
        insightId: insight.id,
        artifact: insight.title || insight.insightKey,
        quality: annotation.label,
        reasons: annotation.reasons,
        reviewStatus: insight.reviewStatus,
        reviewDecision: null,
      },
    };
  });

  const annotated = [...traceabilityItems, ...insightItems];

  return {
    summary: EvidenceQualityAnnotator.summarize(annotated.map((item) => item.annotation)),
    items: annotated.map((item) => item.item),
  };
}
