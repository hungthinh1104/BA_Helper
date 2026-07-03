import type { PersistedArtifact } from '../ports/artifact.repository.port';
import type { EvidenceRecord } from '../ports/evidence.repository.port';
import type { InsightRecord, InsightInputParams } from '../ports/insight.repository.port';
import type { LlmCallMetadata } from '../ports/llm-provider.port';
import type { RetrievedArtifact } from '../ports/retrieval.port';

export type { PersistedArtifact, EvidenceRecord, InsightRecord, InsightInputParams, RetrievedArtifact };

export type ScanArtifact = {
  stableId: string;
  type: string;
  filePath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
};

export type ImpactEvidenceCollectionResult = {
  retrievedArtifacts: RetrievedArtifact[];
  artifactByKey: Map<string, PersistedArtifact>;
  evidenceById: Map<string, EvidenceRecord>;
  evidenceByKey: Map<string, EvidenceRecord>;
  traceabilityLinks: Array<{ id: string; artifactId: string }>;
  retrievalMetadata: {
    strategy: string;
    maxArtifacts: number;
    artifactCount: number;
    vectorSignalCount: number;
  };
};

export type ImpactAiReasoningResult = {
  insightInputs: InsightInputParams[];
  evidencedInsightMap: Array<{ insightKey: string; artifactKeys: string[] }>;
  resolvableEvidencedInsightKeys: Set<string>;
  llmMetadata: LlmCallMetadata | null;
  totalEvidenceChars: number;
  evidenceTruncated: boolean;
  evidenceCandidatesLength: number;
  promptVersion: string;
  executiveSummary?: string;
};
