import type { Prisma } from '@prisma/client';

export type TraceabilityLinkForAnnotation = Prisma.TraceabilityLinkGetPayload<{
  include: {
    artifact: true;
    evidenceLinks: {
      include: {
        evidence: true;
      };
    };
    reviewDecision: true;
  };
}>;

export type InsightForAnnotation = Prisma.BaInsightGetPayload<{
  include: {
    evidenceLinks: {
      include: {
        evidence: {
          include: {
            artifact: true;
          };
        };
      };
    };
  };
}>;

export type QualityLabel =
  | 'STRONG_SOURCE_EVIDENCE'
  | 'WEAK_SOURCE_EVIDENCE'
  | 'INFERRED_FROM_STRUCTURE'
  | 'DOMAIN_HINT_ONLY'
  | 'MISSING_EVIDENCE'
  | 'CONFLICTING_EVIDENCE'
  | 'REVIEW_REQUIRED';

export interface QualityAnnotation {
  label: QualityLabel;
  reasons: string[];
}

export type EvidenceQualityItem = {
  itemType: 'TRACEABILITY_LINK' | 'INSIGHT';
  itemId: string;
  linkId?: string;
  insightId?: string;
  artifact: string;
  quality: QualityLabel;
  reasons: string[];
  reviewDecision?: unknown;
};

export type EvidenceQualitySummary = Record<QualityLabel, number> & {
  strongSourceEvidence: number;
  weakSourceEvidence: number;
  inferredFromStructure: number;
  domainHintOnly: number;
  missingEvidence: number;
  conflictingEvidence: number;
  reviewRequired: number;
  evidenced: number;
  inferred: number;
  weakEvidence: number;
};
