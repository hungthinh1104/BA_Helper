import type {
  EvidenceQualitySummary,
  InsightForAnnotation,
  QualityAnnotation,
  TraceabilityLinkForAnnotation,
} from './evidence-quality.types';
import {
  buildEvidenceReasons,
  emptyEvidenceQualitySummary,
  hasStructuralMetadata,
  hasUsableArtifact,
  inspectEvidence,
  isDomainHintMetadata,
  isReviewRequiredInsight,
  readRecord,
} from './evidence-quality.rules';

export type {
  EvidenceQualityItem,
  EvidenceQualitySummary,
  InsightForAnnotation,
  QualityAnnotation,
  QualityLabel,
  TraceabilityLinkForAnnotation,
} from './evidence-quality.types';

export class EvidenceQualityAnnotator {
  static annotate(link: TraceabilityLinkForAnnotation): QualityAnnotation {
    return this.annotateTraceabilityLink(link);
  }

  static annotateTraceabilityLink(link: TraceabilityLinkForAnnotation): QualityAnnotation {
    const evidence = (link.evidenceLinks ?? []).map((item) => item.evidence);
    const facts = inspectEvidence(evidence, link.artifact);
    const reasons = buildEvidenceReasons(facts);
    const hasArtifactStructure = hasUsableArtifact(link.artifact);

    if (link.reviewStatus === 'NEEDS_REVIEW') {
      reasons.push('reviewRequired');
      return { label: 'REVIEW_REQUIRED', reasons };
    }

    if (link.linkBasis === 'INFERRED') {
      reasons.push('inferredLinkBasis');
      return {
        label: hasArtifactStructure || facts.hasSourceEvidence
          ? 'INFERRED_FROM_STRUCTURE'
          : 'MISSING_EVIDENCE',
        reasons,
      };
    }

    if (facts.hasDomainHintOnly) {
      reasons.push('domainHintOnly');
      return { label: 'DOMAIN_HINT_ONLY', reasons };
    }

    if (!facts.hasEvidence || !facts.hasSourceEvidence) {
      reasons.push('missingPersistedSourceEvidence');
      return { label: 'MISSING_EVIDENCE', reasons };
    }

    return {
      label: facts.hasStrongSourceEvidence ? 'STRONG_SOURCE_EVIDENCE' : 'WEAK_SOURCE_EVIDENCE',
      reasons,
    };
  }

  static annotateInsight(insight: InsightForAnnotation): QualityAnnotation {
    const evidence = (insight.evidenceLinks ?? []).map((item) => item.evidence);
    const facts = inspectEvidence(evidence);
    const reasons = buildEvidenceReasons(facts);
    const metadata = readRecord(insight.metadata);

    if (insight.certainty === 'CONFLICTING') {
      reasons.push('conflictingCertainty');
      return { label: 'CONFLICTING_EVIDENCE', reasons };
    }

    if (isReviewRequiredInsight(insight)) {
      reasons.push('reviewRequired');
      return { label: 'REVIEW_REQUIRED', reasons };
    }

    if (facts.hasDomainHintOnly || isDomainHintMetadata(metadata, insight)) {
      reasons.push('domainHintOnly');
      return { label: 'DOMAIN_HINT_ONLY', reasons };
    }

    if (insight.certainty === 'INFERRED') {
      reasons.push('inferredCertainty');
      return {
        label: facts.hasSourceEvidence || hasStructuralMetadata(metadata)
          ? 'INFERRED_FROM_STRUCTURE'
          : 'MISSING_EVIDENCE',
        reasons,
      };
    }

    if (insight.certainty === 'UNKNOWN') {
      reasons.push('unknownCertainty');
      return { label: 'MISSING_EVIDENCE', reasons };
    }

    if (!facts.hasEvidence || !facts.hasSourceEvidence) {
      reasons.push('missingPersistedSourceEvidence');
      return { label: 'MISSING_EVIDENCE', reasons };
    }

    return {
      label: facts.hasStrongSourceEvidence ? 'STRONG_SOURCE_EVIDENCE' : 'WEAK_SOURCE_EVIDENCE',
      reasons,
    };
  }

  static summarize(annotations: QualityAnnotation[]): EvidenceQualitySummary {
    const counts = emptyEvidenceQualitySummary();
    for (const annotation of annotations) {
      counts[annotation.label]++;
    }

    counts.strongSourceEvidence = counts.STRONG_SOURCE_EVIDENCE;
    counts.weakSourceEvidence = counts.WEAK_SOURCE_EVIDENCE;
    counts.inferredFromStructure = counts.INFERRED_FROM_STRUCTURE;
    counts.domainHintOnly = counts.DOMAIN_HINT_ONLY;
    counts.missingEvidence = counts.MISSING_EVIDENCE;
    counts.conflictingEvidence = counts.CONFLICTING_EVIDENCE;
    counts.reviewRequired = counts.REVIEW_REQUIRED;
    counts.evidenced = counts.strongSourceEvidence;
    counts.inferred = counts.inferredFromStructure;
    counts.weakEvidence = counts.weakSourceEvidence;

    return counts;
  }
}
