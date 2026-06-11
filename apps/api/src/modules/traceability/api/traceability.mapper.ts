export const mapTraceabilityList = (items: Array<{
  id: string;
  artifactId: string;
  linkType: string;
  linkBasis: string;
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
  items.map((link) => ({
    id: link.id,
    artifactId: link.artifactId,
    linkType: link.linkType,
    linkBasis: link.linkBasis,
    reviewStatus: link.reviewStatus,
    confidence: link.confidence ?? null,
    evidence: link.evidenceLinks.map((evidenceLink) => ({
      id: evidenceLink.evidence.id,
      sourceType: evidenceLink.evidence.sourceType,
      filePath: evidenceLink.evidence.sourcePath,
      startLine: evidenceLink.evidence.startLine,
      endLine: evidenceLink.evidence.endLine,
      excerpt: evidenceLink.evidence.excerpt,
    })),
  }));
