import { retrievalMetadataSchema } from '@ba-helper/contracts';
import { Logger } from '@nestjs/common';
import type { TraceabilityLinkWithArtifactAndReviewDecision } from '../infrastructure/traceability.repository';

export const mapTraceabilityList = (items: TraceabilityLinkWithArtifactAndReviewDecision[]) =>
  items.map((link) => {
    const rawRetrieval = link.retrievalMetadata;
    const parsedRetrieval = rawRetrieval ? retrievalMetadataSchema.safeParse(rawRetrieval) : undefined;
    const retrieval = parsedRetrieval?.success ? parsedRetrieval.data : undefined;
    
    if (parsedRetrieval && !parsedRetrieval.success) {
      new Logger('TraceabilityMapper').warn(`INVALID_RETRIEVAL_METADATA_SHAPE: ${parsedRetrieval.error.message}`);
    }

    return {
      id: link.id,
      artifactId: link.artifactId,
      artifactName: link.artifact.name,
      artifactKey: link.artifact.artifactKey,
      filePath: link.artifact.filePath,
      universalKind: link.artifact.universalKind ?? 'UNKNOWN',
      linkType: link.linkType,
      linkBasis: link.linkBasis,
      reviewStatus: link.reviewStatus,
      confidence: link.confidence ?? null,
      retrieval,
      evidence: link.evidenceLinks.map((evidenceLink) => ({
        id: evidenceLink.evidence.id,
        sourceType: evidenceLink.evidence.sourceType,
        filePath: evidenceLink.evidence.sourcePath,
        startLine: evidenceLink.evidence.startLine,
        endLine: evidenceLink.evidence.endLine,
        excerpt: evidenceLink.evidence.excerpt,
        artifactId: evidenceLink.evidence.artifactId ?? undefined,
        artifactKey: evidenceLink.evidence.artifact?.artifactKey ?? undefined,
        retrieval,
      })),
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
        : undefined,
    };
  });
