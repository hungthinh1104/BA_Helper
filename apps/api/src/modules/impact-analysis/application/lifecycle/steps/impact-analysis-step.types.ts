export type PersistedArtifact = {
  id: string;
  artifactKey: string;
  artifactType: string;
  name: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
};

export type ScanArtifact = {
  stableId: string;
  type: string;
  filePath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
};

export type EvidenceRecord = {
  id: string;
  artifactId: string | null;
  excerpt: string;
};

export type InsightRecord = {
  id: string;
  insightKey: string;
  certainty: 'EVIDENCED' | 'INFERRED' | 'UNKNOWN' | 'CONFLICTING';
};

export type ImpactEvidenceCollectionResult = {
  retrievedArtifacts: any[]; // Hybrid retrieval result items
  artifactByKey: Map<string, PersistedArtifact>;
  evidenceById: Map<string, EvidenceRecord>;
  evidenceByKey: Map<string, EvidenceRecord>;
  traceabilityLinks: any[];
  retrievalMetadata: {
    strategy: string;
    maxArtifacts: number;
    artifactCount: number;
    vectorSignalCount: number;
  };
};

export type InsightInputParams = {
  impactAnalysisId: string;
  insightKey: string;
  insightType: 'CLAIM' | 'UNKNOWN' | 'QUESTION' | 'ACCEPTANCE_CRITERIA' | 'QA_SCENARIO';
  certainty: 'EVIDENCED' | 'INFERRED' | 'UNKNOWN' | 'CONFLICTING';
  reviewStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
  confidence: number | null;
  title: string;
  description: string;
  reasoning?: string | null;
  metadata?: any;
};

export type ImpactAiReasoningResult = {
  insightInputs: InsightInputParams[];
  evidencedInsightMap: Array<{ insightKey: string; artifactKeys: string[] }>;
  resolvableEvidencedInsightKeys: Set<string>;
  llmMetadata: any;
  totalEvidenceChars: number;
  evidenceTruncated: boolean;
  evidenceCandidatesLength: number;
  promptVersion: string;
};
