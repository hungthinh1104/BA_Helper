import { retrievalMetadataSchema } from '@ba-helper/contracts';

export const mapInsightList = (items: Array<{
  id: string;
  insightType: string;
  description: string;
  certainty: string;
  reviewStatus: string;
  confidence: number | null;
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
  items.map((insight) => ({
    id: insight.id,
    category: insight.insightType,
    statement: insight.description,
    certainty: insight.certainty,
    reviewStatus: insight.reviewStatus,
    confidence: insight.confidence ?? null,
    evidence: insight.evidenceLinks.map((link) => {
      const rawRetrieval = (link.evidence as any).retrievalMetadata;
      const parsedRetrieval = rawRetrieval ? retrievalMetadataSchema.safeParse(rawRetrieval) : undefined;
      const retrieval = parsedRetrieval?.success ? parsedRetrieval.data : undefined;
      
      if (parsedRetrieval && !parsedRetrieval.success) {
        console.warn('INVALID_RETRIEVAL_METADATA_SHAPE', parsedRetrieval.error);
      }

      return {
        id: link.evidence.id,
        sourceType: link.evidence.sourceType,
        filePath: link.evidence.sourcePath,
        startLine: link.evidence.startLine,
        endLine: link.evidence.endLine,
        excerpt: link.evidence.excerpt,
        retrieval,
      };
    }),
  }));
