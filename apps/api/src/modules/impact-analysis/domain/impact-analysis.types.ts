export type ImpactAnalysisMetadata = {
  llm?: {
    provider: string;
    model: string;
    promptVersion: string;
    parseMode?: 'raw' | 'extracted';
    inputTokens?: number | null;
    outputTokens?: number | null;
    estimatedCostUsd?: number | null;
    evidenceItems?: number;
    evidenceChars?: number;
    evidenceTruncated?: boolean;
    /** Domain profile key used for context injection. 'BOOKING' if none specified. */
    domainContextUsed?: string;
  };
  retrieval?: {
    strategy: string;
    maxArtifacts: number;
    artifactCount: number;
    vectorSignalCount?: number;
  };
};
