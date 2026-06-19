import { Prisma } from '@prisma/client';

export type TraceabilityLinkForAnnotation = Prisma.TraceabilityLinkGetPayload<{
  include: {
    artifact: true;
    evidenceLinks: {
      include: {
        evidence: true;
      };
    };
  };
}>;

export type QualityLabel = 'EVIDENCED' | 'INFERRED' | 'WEAK_EVIDENCE' | 'MISSING_EVIDENCE' | 'REVIEW_REQUIRED';

export interface QualityAnnotation {
  label: QualityLabel;
  reasons: string[];
}

export class EvidenceQualityAnnotator {
  static annotate(link: TraceabilityLinkForAnnotation): QualityAnnotation {
    const hasEvidence = link.evidenceLinks && link.evidenceLinks.length > 0;
    const hasSourceSnippet = hasEvidence && link.evidenceLinks.some(e => !!e.evidence.excerpt);
    const hasFilePath = !!link.artifact?.filePath;
    const hasSymbolName = !!link.artifact?.name && !link.artifact.name.includes('UNKNOWN');
    const hasLineRange = hasEvidence && link.evidenceLinks.some(e => e.evidence.startLine !== null && e.evidence.endLine !== null);
    
    const retrievalMetadata = (link.retrievalMetadata as any) || {};
    const hasRetrieverScore = retrievalMetadata.semanticScore !== undefined || retrievalMetadata.bm25Score !== undefined;
    const hasMultipleSignals = Array.isArray(retrievalMetadata.signals) && retrievalMetadata.signals.length > 1;
    
    const inferredOnly = link.linkBasis === 'INFERRED';
    const missingSourceQuote = !hasSourceSnippet;
    const staleOrUnverified = link.reviewStatus === 'NEEDS_REVIEW';

    const reasons: string[] = [];

    if (hasSourceSnippet) reasons.push('hasSourceSnippet');
    if (hasFilePath) reasons.push('hasFilePath');
    if (hasSymbolName) reasons.push('hasSymbolName');
    if (hasLineRange) reasons.push('hasLineRange');
    if (hasRetrieverScore) reasons.push('hasRetrieverScore');
    if (hasMultipleSignals) reasons.push('hasMultipleSignals');
    if (missingSourceQuote) reasons.push('missingSourceQuote');
    if (inferredOnly) reasons.push('inferredOnly');
    if (staleOrUnverified) reasons.push('staleOrUnverified');

    let label: QualityLabel;

    // Precedence: REVIEW_REQUIRED > MISSING_EVIDENCE > WEAK_EVIDENCE > INFERRED > EVIDENCED
    if (staleOrUnverified) {
      label = 'REVIEW_REQUIRED';
    } else if (!hasFilePath || !hasEvidence || missingSourceQuote) {
      label = 'MISSING_EVIDENCE';
    } else if (!hasLineRange && !hasSymbolName && !hasRetrieverScore) {
      label = 'WEAK_EVIDENCE';
    } else if (inferredOnly) {
      label = 'INFERRED';
    } else {
      label = 'EVIDENCED';
    }

    return {
      label,
      reasons,
    };
  }
}
