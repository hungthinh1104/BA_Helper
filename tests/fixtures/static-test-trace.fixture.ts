import type { QaCoverageResponse } from '@ba-helper/contracts';

export const traceIds = {
  analysis: '00000000-0000-4000-8000-000000000004', snapshot: '00000000-0000-4000-8000-000000000005',
  test: '00000000-0000-4000-8000-000000000001', code: '00000000-0000-4000-8000-000000000002',
  evidence: '00000000-0000-4000-8000-000000000003',
};

export function staticTestTraceFixture(): QaCoverageResponse {
  return { analysisId: traceIds.analysis, snapshotId: traceIds.snapshot,
    traceContext: { basis: 'STATIC_SOURCE_REFERENCE', commitSha: 'a'.repeat(40), analyzerVersion: 'analyzer@0.5.0',
      snapshotCoverageStatus: 'READY', limitations: [],
      limits: { maxCallDepth: 4, maxImpactedArtifacts: 1000, maxEdges: 5000, maxTracesPerArtifact: 3 } },
    summary: { covered: 1, indirectOnly: 0, noTestFound: 0, highSeverityGaps: 0 },
    items: [{ artifactId: traceIds.code, artifactKey: 'service:refund', artifactLabel: 'PaymentService.refund',
      artifactType: 'SERVICE_METHOD', filePath: 'src/payment.service.ts', status: 'COVERED', severity: 'HIGH',
      reason: 'Direct static reference', suggestedAction: 'Review assertions.', confidenceNote: 'No execution coverage was measured.',
      testArtifacts: [{ id: traceIds.test, label: 'refunds once', filePath: 'src/payment.spec.ts', artifactKey: 'test-case:refund',
        testCase: { framework: 'jest', suitePath: ['Payment'], title: 'refunds once', modifier: 'NORMAL', declaredModifier: 'NORMAL',
          parentFileArtifactKey: 'test:src.payment.spec.ts' },
        trace: { relation: 'DIRECT_REFERENCE', artifacts: [
          { id: traceIds.test, artifactKey: 'test-case:refund', label: 'refunds once', artifactType: 'TEST', filePath: 'src/payment.spec.ts', startLine: 3, endLine: 8 },
          { id: traceIds.code, artifactKey: 'service:refund', label: 'PaymentService.refund', artifactType: 'SERVICE_METHOD', filePath: 'src/payment.service.ts', startLine: 2, endLine: 4 },
        ], edges: [{ edgeId: 'edge-1', sourceArtifactId: traceIds.test, targetArtifactId: traceIds.code, type: 'TESTS', evidenceId: traceIds.evidence,
          provenance: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
            evidenceProvenanceKey: `snapshot:${traceIds.snapshot}:artifact:test-case:refund`,
            locations: [{ sourcePath: 'src/payment.spec.ts', startLine: 5, endLine: 5 }] } }] } }],
    }] };
}
