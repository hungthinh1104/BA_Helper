import { codeArtifactMetadataSchema, dependencyEdgeProvenanceSchema, dependencyConfidenceSchema } from '@ba-helper/contracts';
import type { GraphNodeType } from '@ba-helper/contracts';
import { createArtifactIdentity } from '@ba-helper/shared';
import type { QaTraceArtifact, QaTraceEdge, QaTraceEvidence, ValidatedQaTraceEdge } from './qa-trace.types';

export function qaTraceArtifactType(artifact: QaTraceArtifact): GraphNodeType | undefined {
  const raw: Record<string, GraphNodeType> = { CONTROLLER: 'CONTROLLER', SERVICE: 'SERVICE',
    API_ROUTE: 'API_ROUTE', HTTP_ENDPOINT: 'API_ROUTE', SERVICE_METHOD: 'SERVICE_METHOD', ENTITY: 'ENTITY',
    TEST: 'TEST', SPRING_TEST: 'TEST', JEST_TEST_CASE: 'TEST' };
  const universal: Record<string, GraphNodeType> = { API_ENDPOINT: 'API_ROUTE', DOMAIN_SERVICE: 'SERVICE_METHOD',
    DATA_MODEL: 'ENTITY', TEST_FILE: 'TEST', TEST_CASE: 'TEST' };
  return raw[artifact.artifactType] ?? universal[artifact.universalKind];
}

export function isQaTraceCode(artifact: QaTraceArtifact): boolean {
  const type = qaTraceArtifactType(artifact);
  return type !== undefined && type !== 'TEST';
}

export function activeJestCase(artifact: QaTraceArtifact) {
  if (artifact.artifactType !== 'JEST_TEST_CASE') return undefined;
  const metadata = codeArtifactMetadataSchema.safeParse(artifact.metadata);
  if (!metadata.success) return undefined;
  const test = metadata.data.testCase;
  if (!['NORMAL', 'ONLY'].includes(test.modifier) ||
    test.parentFileArtifactKey !== createArtifactIdentity('test', artifact.filePath, 'file')) return undefined;
  return test;
}

export function validateQaTraceEdge(
  edge: QaTraceEdge, snapshotId: string, artifacts: Map<string, QaTraceArtifact>,
  evidences: Map<string, QaTraceEvidence>,
): ValidatedQaTraceEdge | undefined {
  if (edge.snapshotId !== snapshotId || !['TESTS', 'CALLS'].includes(edge.type)) return undefined;
  const from = artifacts.get(edge.fromArtifactId), to = artifacts.get(edge.toArtifactId);
  if (!from || !to || from.snapshotId !== snapshotId || to.snapshotId !== snapshotId || !isQaTraceCode(to)) return undefined;
  if (edge.type === 'TESTS' ? !activeJestCase(from) : !isQaTraceCode(from)) return undefined;
  const parsed = dependencyEdgeProvenanceSchema.safeParse(edge.metadata);
  if (!parsed.success || parsed.data.resolver !== 'TS_AST_DIRECT_CALL') return undefined;
  const provenance = parsed.data;
  if (provenance.evidenceProvenanceKey !== `snapshot:${snapshotId}:artifact:${from.artifactKey}`) return undefined;
  const evidence = evidences.get(provenance.evidenceProvenanceKey);
  if (!evidence || evidence.snapshotId !== snapshotId || evidence.artifactId !== from.id ||
    evidence.sourcePath !== from.filePath || !evidence.excerpt.trim() ||
    evidence.sourceType !== (edge.type === 'TESTS' ? 'TEST' : 'CODE')) return undefined;
  if (provenance.locations.some(location => location.sourcePath !== from.filePath ||
    from.startLine === null || from.endLine === null || evidence.startLine === null || evidence.endLine === null ||
    location.startLine < Math.max(from.startLine, evidence.startLine) ||
    location.endLine > Math.min(from.endLine, evidence.endLine))) return undefined;
  if (edge.confidence !== null && !dependencyConfidenceSchema.safeParse(edge.confidence).success) return undefined;
  return { ...edge, type: edge.type as 'TESTS' | 'CALLS', provenance, evidenceId: evidence.id };
}
