import { reportTestTraceSnapshotSchema } from './src';
import { staticTestTraceFixture } from '../../tests/fixtures/static-test-trace.fixture';

describe('saved report trace boundary', () => {
  it('accepts a versioned source projection', () => {
    expect(reportTestTraceSnapshotSchema.safeParse({ version: 1, coverage: staticTestTraceFixture() }).success).toBe(true);
  });
  it('rejects source evidence from another snapshot and a disconnected impacted row', () => {
    const coverage = staticTestTraceFixture();
    coverage.items[0].testArtifacts[0].trace!.edges[0].provenance.evidenceProvenanceKey = 'snapshot:foreign:artifact:test-case:refund';
    expect(reportTestTraceSnapshotSchema.safeParse({ version: 1, coverage }).success).toBe(false);
    const other = staticTestTraceFixture(); other.items[0].artifactId = 'unrelated';
    expect(reportTestTraceSnapshotSchema.safeParse({ version: 1, coverage: other }).success).toBe(false);
  });
  it('does not upgrade file-only or unversioned trace data into a frozen case path', () => {
    const coverage = staticTestTraceFixture(); coverage.items[0].testArtifacts[0].testCase = undefined;
    expect(reportTestTraceSnapshotSchema.safeParse({ version: 1, coverage }).success).toBe(false);
    expect(reportTestTraceSnapshotSchema.safeParse({ version: 2, coverage: staticTestTraceFixture() }).success).toBe(false);
  });
});
