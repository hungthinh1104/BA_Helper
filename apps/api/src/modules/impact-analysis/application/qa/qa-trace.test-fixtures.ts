import type { QaTraceArtifact, QaTraceEdge, QaTraceEvidence, QaTraceInput } from '../../domain/qa-trace.types';

export function artifact(id: string, overrides: Partial<QaTraceArtifact> = {}): QaTraceArtifact {
  return { id, snapshotId: 'snapshot', artifactKey: `service:${id}`, name: id,
    artifactType: 'SERVICE_METHOD', universalKind: 'DOMAIN_SERVICE', filePath: `src/${id}.ts`,
    startLine: 1, endLine: 30, metadata: null, ...overrides };
}

export function testCase(id = 'test', modifier = 'NORMAL'): QaTraceArtifact {
  const filePath = `src/${id}.spec.ts`;
  return artifact(id, { artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE', filePath,
    artifactKey: `test-case:${filePath}::identity`, metadata: { testCase: { framework: 'jest',
      suitePath: ['Booking'], title: 'cancels and refunds', modifier, declaredModifier: modifier,
      parentFileArtifactKey: `test:${filePath.replace(/[/\\]/g, '.')}` } } });
}

export function edge(id: string, from: QaTraceArtifact, to: QaTraceArtifact, type = 'CALLS'): QaTraceEdge {
  return { id, snapshotId: 'snapshot', fromArtifactId: from.id, toArtifactId: to.id,
    type, confidence: 1, metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
      evidenceProvenanceKey: `snapshot:snapshot:artifact:${from.artifactKey}`,
      locations: [{ sourcePath: from.filePath, startLine: 12, endLine: 12 }] } };
}

export function evidence(from: QaTraceArtifact): QaTraceEvidence {
  return { id: `evidence-${from.id}`, snapshotId: 'snapshot', artifactId: from.id,
    provenanceKey: `snapshot:snapshot:artifact:${from.artifactKey}`, sourcePath: from.filePath,
    sourceType: from.artifactType === 'JEST_TEST_CASE' ? 'TEST' : 'CODE',
    startLine: 1, endLine: 30, excerpt: 'Redacted persisted source excerpt' };
}

export function input(impacted: QaTraceArtifact[], extra: QaTraceArtifact[] = [], edges: QaTraceEdge[] = []): QaTraceInput {
  const artifacts = [...impacted, ...extra];
  return { analysisId: 'analysis', snapshot: { id: 'snapshot', commitSha: 'commit',
    analyzerVersion: 'analyzer@0.5.0', coverageStatus: 'READY', diagnostics: [] },
    impactedArtifactIds: impacted.map(a => a.id), artifacts, edges,
    evidences: artifacts.map(evidence), limitations: [] };
}
