import { Injectable } from '@nestjs/common';
import type { QaCoverageResponse, QaTraceLimitation } from '@ba-helper/contracts';
import { isQaTraceCode, validateQaTraceEdge } from '../../domain/qa-trace.policy';
import { findQaTestPaths } from '../../domain/qa-trace-paths';
import { QA_TRACE_LIMITS } from '../../domain/qa-trace.types';
import type { QaTraceArtifact, QaTraceInput, ValidatedQaTraceEdge } from '../../domain/qa-trace.types';
import { compareQaCoverageItems, mapQaCoverageItem } from './qa-trace.mapper';

@Injectable()
export class QaCoverageDeriver {
  derive(input: QaTraceInput): QaCoverageResponse {
    const { snapshot } = input;
    const artifacts = new Map(input.artifacts.map(a => [a.id, a]));
    const limitations = new Set(input.limitations);
    const incoming = this.indexEdges(input, limitations);
    const impacted: QaTraceArtifact[] = [];
    const excludedImpactedArtifacts: NonNullable<NonNullable<QaCoverageResponse['traceContext']>['excludedImpactedArtifacts']> = [];
    for (const id of new Set(input.impactedArtifactIds)) {
      const artifact = artifacts.get(id);
      if (artifact && artifact.snapshotId === snapshot.id && isQaTraceCode(artifact)) {
        impacted.push(artifact);
        continue;
      }
      // Do not expose metadata from a foreign snapshot through this analysis response.
      const safeArtifact = artifact?.snapshotId === snapshot.id ? artifact : undefined;
      excludedImpactedArtifacts.push({
        artifactId: id, artifactKey: safeArtifact?.artifactKey, artifactType: safeArtifact?.artifactType,
        universalKind: safeArtifact?.universalKind,
        reason: !artifact ? 'MISSING_ARTIFACT' : artifact.snapshotId !== snapshot.id ? 'FOREIGN_SNAPSHOT' : 'UNSUPPORTED_TYPE',
      });
    }
    if (excludedImpactedArtifacts.length > 0) limitations.add('UNSUPPORTED_IMPACT_ARTIFACT');
    const items = impacted.map(artifact => {
      const result = findQaTestPaths(artifact.id, incoming);
      if (result.truncated) limitations.add('TRACE_SAMPLE_LIMIT');
      if (result.depthLimited) limitations.add('CALL_DEPTH_LIMIT');
      return mapQaCoverageItem(artifact, result.paths, artifacts, result.truncated);
    }).sort(compareQaCoverageItems);
    if (snapshot.coverageStatus === 'PARTIAL') limitations.add('SNAPSHOT_PARTIAL');
    if (/^analyzer@0\.[0-4]\./.test(snapshot.analyzerVersion)) limitations.add('LEGACY_TEST_IDENTITIES');
    if (hasScannerLimitations(snapshot.diagnostics)) limitations.add('SCANNER_LIMITATIONS');
    // Keep the historical wire names: "covered" counts direct source references only.
    return { analysisId: input.analysisId, snapshotId: snapshot.id,
      traceContext: { basis: 'STATIC_SOURCE_REFERENCE', commitSha: snapshot.commitSha,
        analyzerVersion: snapshot.analyzerVersion, snapshotCoverageStatus: snapshot.coverageStatus,
        limits: QA_TRACE_LIMITS, limitations: [...limitations].sort(), excludedImpactedArtifacts },
      summary: { covered: items.filter(i => i.status === 'COVERED').length,
        indirectOnly: items.filter(i => i.status === 'INDIRECT_ONLY').length,
        noTestFound: items.filter(i => i.status === 'NO_TEST_FOUND').length,
        highSeverityGaps: items.filter(i => i.status === 'NO_TEST_FOUND' && i.severity === 'HIGH').length }, items };
  }

  private indexEdges(input: QaTraceInput, limitations: Set<QaTraceLimitation>) {
    const artifacts = new Map(input.artifacts.map(a => [a.id, a]));
    const evidences = new Map(input.evidences.map(e => [e.provenanceKey, e]));
    const incoming = new Map<string, ValidatedQaTraceEdge[]>();
    for (const edge of input.edges) {
      if (!['TESTS', 'CALLS'].includes(edge.type)) continue;
      const validated = validateQaTraceEdge(edge, input.snapshot.id, artifacts, evidences);
      if (!validated) { limitations.add('UNSUPPORTED_SOURCE_RELATIONSHIP'); continue; }
      const edges = incoming.get(edge.toArtifactId) ?? [];
      edges.push(validated);
      incoming.set(edge.toArtifactId, edges);
    }
    for (const edges of incoming.values()) edges.sort((a, b) =>
      artifacts.get(a.fromArtifactId)!.artifactKey.localeCompare(artifacts.get(b.fromArtifactId)!.artifactKey) || a.id.localeCompare(b.id));
    return incoming;
  }
}

function hasScannerLimitations(diagnostics: unknown): boolean {
  return Array.isArray(diagnostics) && diagnostics.some(item => item && typeof item === 'object' &&
    typeof item.code === 'string' && /^(JEST_|TEST_TARGET_UNRESOLVED|UNRESOLVED_|AMBIGUOUS_ARTIFACT_IDENTITY)/.test(item.code));
}
