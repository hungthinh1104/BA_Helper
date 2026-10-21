import { qaCoverageResponseSchema, qaTestTraceSchema } from './src';

describe('static test trace wire contract', () => {
  const test = { id: 'test', artifactKey: 'test-key', label: 'refund case', artifactType: 'TEST', filePath: 'test/refund.spec.ts' };
  const code = { id: 'code', artifactKey: 'code-key', label: 'refund', artifactType: 'SERVICE_METHOD', filePath: 'src/refund.ts' };
  const edge = { edgeId: 'edge', sourceArtifactId: 'test', targetArtifactId: 'code', type: 'TESTS', evidenceId: 'evidence',
    provenance: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
      evidenceProvenanceKey: 'snapshot:s:artifact:test-key',
      locations: [{ sourcePath: test.filePath, startLine: 4, endLine: 4 }] } };
  const trace = { relation: 'DIRECT_REFERENCE', artifacts: [test, code], edges: [edge] };

  it('preserves legacy responses without trace fields', () => {
    expect(qaCoverageResponseSchema.safeParse({ analysisId: 'a', snapshotId: 's',
      summary: { covered: 0, indirectOnly: 0, noTestFound: 0, highSeverityGaps: 0 }, items: [] }).success).toBe(true);
  });

  it('requires connected semantic edges starting at a test case', () => {
    expect(qaTestTraceSchema.safeParse(trace).success).toBe(true);
    expect(qaTestTraceSchema.safeParse({ ...trace, edges: [{ ...edge, sourceArtifactId: 'other' }] }).success).toBe(false);
    expect(qaTestTraceSchema.safeParse({ ...trace, artifacts: [code, test] }).success).toBe(false);
    expect(qaTestTraceSchema.safeParse({ ...trace, edges: [{ ...edge, type: 'CALLS' }] }).success).toBe(false);
    expect(qaTestTraceSchema.safeParse({ ...trace, artifacts: [{ ...test, artifactType: 'SERVICE' }, code] }).success).toBe(false);
  });

  it('rejects self cycles and a direct label on a multi-step call path', () => {
    const cycle = { ...trace, relation: 'CALL_PATH', artifacts: [test, code, code],
      edges: [edge, { ...edge, edgeId: 'call', type: 'CALLS', sourceArtifactId: 'code' }] };
    expect(qaTestTraceSchema.safeParse(cycle).success).toBe(false);
    expect(qaTestTraceSchema.safeParse({ ...trace, relation: 'CALL_PATH' }).success).toBe(false);
  });
});
