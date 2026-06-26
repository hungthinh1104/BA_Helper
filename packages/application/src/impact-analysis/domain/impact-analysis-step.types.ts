import type { PersistedArtifact } from '../ports/artifact.repository.port';
import type { EvidenceRecord } from '../ports/evidence.repository.port';
import type { InsightRecord, InsightInputParams } from '../ports/insight.repository.port';
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
  artifactByKey: Map<string, import('../ports/artifact.repository.port').PersistedArtifact>;
  evidenceById: Map<string, import('../ports/evidence.repository.port').EvidenceRecord>;
  evidenceByKey: Map<string, import('../ports/evidence.repository.port').EvidenceRecord>;
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
  llmMetadata: import('../ports/llm-provider.port').LlmCallMetadata | null;
  totalEvidenceChars: number;
  evidenceTruncated: boolean;
  evidenceCandidatesLength: number;
  promptVersion: string;
};
