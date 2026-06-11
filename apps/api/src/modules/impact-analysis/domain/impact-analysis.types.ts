export type ImpactAnalysisMetadata = {
  llm?: {
    provider: string;
    model: string;
    promptVersion: string;
    parseMode?: 'raw' | 'extracted';
    inputTokens?: number;
    outputTokens?: number;
    rawLength?: number;
    jsonLength?: number;
    generatedAt: string;
  };
  retrieval?: {
    strategy: string;
    maxArtifacts: number;
    artifactCount: number;
  };
};
