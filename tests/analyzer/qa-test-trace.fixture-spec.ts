import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SafeFileEnumerator, ANALYZER_VERSION } from '@ba-helper/analyzer';
import { TypeScriptNestJsAdapter } from '../../packages/analyzer/src/scanner/adapters/typescript-nestjs.adapter';
import { buildArtifactInputs } from '../../packages/backend-runtime/src/scanner/application/scan-artifact.mapper';
import { buildDependencyEdges, buildEvidenceInputs } from '../../packages/backend-runtime/src/scanner/application/scan-persistence-mappers';
import { QaCoverageDeriver } from '../../apps/api/src/modules/impact-analysis/application/qa/qa-coverage.deriver';
import { qaCoverageResponseSchema } from '@ba-helper/contracts';

describe('booking/refund static test trace fixture', () => {
  it('projects real adapter output through persistence mappers with an independently authored trace expectation', async () => {
    const root = resolve(__dirname, '../fixtures/nestjs-booking-with-payment');
    const expected = JSON.parse(readFileSync(resolve(root, 'expected/qa-test-traces.json'), 'utf8')) as {
      caseKey: string; items: Array<{ artifactKey: string; status: string; callPath: string[] }>;
    };
    const files = await new SafeFileEnumerator(root).enumerate();
    const scan = await new TypeScriptNestJsAdapter().scan({ rootDir: root, tsFiles: files.tsFiles });
    const collector = { add: jest.fn(), addSecretRedacted: jest.fn(), getItems: () => [] };
    const artifacts = buildArtifactInputs('snapshot', scan.artifacts, collector).map((a, i) => ({
      ...a, id: `artifact-${i}`, startLine: a.startLine ?? null, endLine: a.endLine ?? null, metadata: a.metadata ?? null,
    }));
    const refs = new Map(artifacts.map(a => [a.artifactKey, a.id]));
    const edges = buildDependencyEdges('snapshot', scan.dependencyEdges, refs).edgesToPersist.map((edge, i) => ({
      ...edge, id: `edge-${i}`, confidence: edge.confidence ?? null, metadata: edge.metadata ?? null,
    }));
    const evidences = buildEvidenceInputs({ snapshotId: 'snapshot', artifacts: scan.artifacts,
      persistedArtifacts: artifacts, collector }).map((ev, i) => ({ ...ev, id: `evidence-${i}` }));
    const result = qaCoverageResponseSchema.parse(new QaCoverageDeriver().derive({
      analysisId: 'analysis', snapshot: { id: 'snapshot', commitSha: 'fixture-commit',
        analyzerVersion: ANALYZER_VERSION, coverageStatus: 'READY', diagnostics: scan.diagnostics },
      impactedArtifactIds: expected.items.map(i => refs.get(i.artifactKey)!), artifacts, edges, evidences, limitations: [],
    }));
    expect(result.items).toHaveLength(expected.items.length);
    for (const row of expected.items) {
      const actual = result.items.find(i => i.artifactKey === row.artifactKey)!;
      expect(actual.status).toBe(row.status);
      if (!row.callPath.length) { expect(actual.testArtifacts).toEqual([]); continue; }
      expect(actual.testArtifacts).toHaveLength(1);
      expect(actual.testArtifacts[0].artifactKey).toBe(expected.caseKey);
      const trace = actual.testArtifacts[0].trace!;
      expect(trace.artifacts.map(a => a.artifactKey)).toEqual([expected.caseKey, ...row.callPath]);
      expect(trace.edges.map(e => e.type)).toEqual(['TESTS', ...row.callPath.slice(1).map(() => 'CALLS')]);
      for (const edge of trace.edges) {
        const ev = evidences.find(e => e.id === edge.evidenceId)!;
        expect(ev.provenanceKey).toBe(edge.provenance.evidenceProvenanceKey);
        expect(ev.artifactId).toBe(edge.sourceArtifactId);
      }
      expect(actual.confidenceNote).toContain('No execution or assertion coverage');
    }
    expect(result.traceContext?.limitations).not.toContain('UNSUPPORTED_SOURCE_RELATIONSHIP');
  });
});
