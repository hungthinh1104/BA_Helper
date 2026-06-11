export const mapEvidenceList = (items: Array<{
  id: string;
  sourceType: string;
  sourcePath: string | null;
  startLine: number | null;
  endLine: number | null;
  excerpt: string;
}>) =>
  items.map((evidence) => ({
    id: evidence.id,
    sourceType: evidence.sourceType,
    filePath: evidence.sourcePath,
    startLine: evidence.startLine,
    endLine: evidence.endLine,
    excerpt: evidence.excerpt,
  }));
