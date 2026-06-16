import { retrievalMetadataSchema } from '@ba-helper/contracts';
import { Logger } from '@nestjs/common';

export const mapTraceabilityList = (items: Array<{
  id: string;
  artifactId: string;
  artifact: {
    name: string;
    artifactKey: string;
    filePath: string;
    universalKind: string;
  };
  linkType: string;
  linkBasis: string;
  reviewStatus: string;
  confidence: number | null;
  retrievalMetadata?: unknown;
    evidenceLinks: Array<{
      evidence: {
        id: string;
        sourceType: string;
        sourcePath: string | null;
        startLine: number | null;
        endLine: number | null;
        excerpt: string;
        artifactId?: string | null;
        artifact?: {
          artifactKey?: string | null;
        } | null;
      };
    }>;
}>) =>
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
        artifactKey: (evidenceLink.evidence as any).artifact?.artifactKey ?? undefined,
        retrieval,
      })),
    };
  });
