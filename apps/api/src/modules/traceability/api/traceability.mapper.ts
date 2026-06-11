import { retrievalMetadataSchema } from '@ba-helper/contracts';

export const mapTraceabilityList = (items: Array<{
  id: string;
  artifactId: string;
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
    };
  }>;
}>) =>
  items.map((link) => {
    const rawRetrieval = link.retrievalMetadata;
    const parsedRetrieval = rawRetrieval ? retrievalMetadataSchema.safeParse(rawRetrieval) : undefined;
    const retrieval = parsedRetrieval?.success ? parsedRetrieval.data : undefined;
    
    if (parsedRetrieval && !parsedRetrieval.success) {
      console.warn('INVALID_RETRIEVAL_METADATA_SHAPE', parsedRetrieval.error);
    }

    return {
      id: link.id,
      artifactId: link.artifactId,
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
        retrieval,
      })),
    };
  });
