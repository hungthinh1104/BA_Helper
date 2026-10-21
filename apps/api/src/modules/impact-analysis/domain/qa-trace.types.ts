import type { DependencyEdgeProvenance, QaTraceLimitation } from '@ba-helper/contracts';

export const QA_TRACE_LIMITS = {
  maxCallDepth: 4, maxImpactedArtifacts: 1000, maxEdges: 5000, maxTracesPerArtifact: 3,
} as const;

export type QaTraceArtifact = {
  id: string; snapshotId: string; artifactKey: string; name: string;
  artifactType: string; universalKind: string; filePath: string;
  startLine: number | null; endLine: number | null; metadata: unknown;
};

export type QaTraceEdge = {
  id: string; snapshotId: string; fromArtifactId: string; toArtifactId: string;
  type: string; confidence: number | null; metadata: unknown;
};

export type QaTraceEvidence = {
  id: string; snapshotId: string | null; artifactId: string | null; provenanceKey: string;
  sourceType: string; sourcePath: string | null;
  startLine: number | null; endLine: number | null; excerpt: string;
};

export type QaTraceInput = {
  analysisId: string;
  snapshot: { id: string; commitSha: string; analyzerVersion: string;
    coverageStatus: 'READY' | 'PARTIAL'; diagnostics: unknown };
  impactedArtifactIds: string[]; artifacts: QaTraceArtifact[];
  edges: QaTraceEdge[]; evidences: QaTraceEvidence[]; limitations: QaTraceLimitation[];
};

export type ValidatedQaTraceEdge = QaTraceEdge & {
  type: 'TESTS' | 'CALLS'; provenance: DependencyEdgeProvenance; evidenceId: string;
};
