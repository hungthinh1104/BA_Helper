import type { QaCoverageItem, QaCoverageSeverity, QaCoverageStatus, QaTraceArtifact as QaTraceArtifactDto } from '@ba-helper/contracts';
import { activeJestCase, qaTraceArtifactType } from '../../domain/qa-trace.policy';
import type { QaTraceArtifact, ValidatedQaTraceEdge } from '../../domain/qa-trace.types';

export const STATIC_TEST_TRACE_NOTE = 'Static source references only. No execution or assertion coverage was measured; dependencies may be mocked.';

export function mapQaTraceArtifact(artifact: QaTraceArtifact): QaTraceArtifactDto {
  return { id: artifact.id, artifactKey: artifact.artifactKey, label: artifact.name,
    artifactType: qaTraceArtifactType(artifact)!, filePath: artifact.filePath,
    startLine: artifact.startLine ?? undefined, endLine: artifact.endLine ?? undefined };
}

function mapTestPath(path: ValidatedQaTraceEdge[], artifacts: Map<string, QaTraceArtifact>): QaCoverageItem['testArtifacts'][number] {
  const test = artifacts.get(path[0].fromArtifactId)!;
  return { id: test.id, label: test.name, artifactKey: test.artifactKey, filePath: test.filePath,
    testCase: activeJestCase(test), trace: {
      relation: path.length === 1 ? 'DIRECT_REFERENCE' : 'CALL_PATH',
      artifacts: [test, ...path.map(edge => artifacts.get(edge.toArtifactId)!)].map(mapQaTraceArtifact),
      edges: path.map(edge => ({ edgeId: edge.id, sourceArtifactId: edge.fromArtifactId,
        targetArtifactId: edge.toArtifactId, type: edge.type, confidence: edge.confidence ?? undefined,
        provenance: edge.provenance, evidenceId: edge.evidenceId })),
    } };
}

export function mapQaCoverageItem(artifact: QaTraceArtifact, paths: ValidatedQaTraceEdge[][],
  artifacts: Map<string, QaTraceArtifact>, truncated: boolean): QaCoverageItem {
  const type = qaTraceArtifactType(artifact)!;
  const status: QaCoverageStatus = paths.some(path => path.length === 1) ? 'COVERED'
    : paths.length ? 'INDIRECT_ONLY' : 'NO_TEST_FOUND';
  const severity: QaCoverageSeverity = ['API_ROUTE', 'SERVICE_METHOD'].includes(type) ? 'HIGH'
    : type === 'SERVICE' ? 'MEDIUM' : 'LOW';
  const reasons: Record<QaCoverageStatus, string> = {
    COVERED: 'A supported test source declaration directly references this code in the inspected snapshot.',
    INDIRECT_ONLY: 'A supported test source declaration reaches this code through an inspected static call path.',
    NO_TEST_FOUND: 'No supported static test reference was found in the inspected snapshot paths.',
  };
  const actions: Record<QaCoverageStatus, string> = {
    COVERED: 'Review the case assertions and run relevant regression tests for the changed behavior.',
    INDIRECT_ONLY: 'Review the call path and mocks; add direct regression tests for the changed behavior.',
    NO_TEST_FOUND: 'Inspect scan/search limitations and add or locate regression tests for the changed behavior.',
  };
  return { artifactId: artifact.id, artifactKey: artifact.artifactKey, artifactLabel: artifact.name,
    artifactType: type, filePath: artifact.filePath, status, severity,
    testArtifacts: paths.map(path => mapTestPath(path, artifacts)), tracesTruncated: truncated,
    reason: reasons[status], suggestedAction: actions[status], confidenceNote: STATIC_TEST_TRACE_NOTE };
}

export function compareQaCoverageItems(a: QaCoverageItem, b: QaCoverageItem): number {
  const statusRank = { NO_TEST_FOUND: 0, INDIRECT_ONLY: 1, COVERED: 2 };
  const severityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return statusRank[a.status] - statusRank[b.status] || severityRank[a.severity] - severityRank[b.severity] ||
    (a.artifactKey ?? a.artifactId).localeCompare(b.artifactKey ?? b.artifactId);
}
