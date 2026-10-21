import { qaCoverageResponseSchema } from '@ba-helper/contracts';
import { QaCoverageDeriver } from './qa-coverage.deriver';
import { artifact, edge, evidence, input, testCase } from './qa-trace.test-fixtures';

describe('snapshot-scoped static test trace projection', () => {
  const deriver = new QaCoverageDeriver();

  it('projects a parameterized source declaration without multiplying paths into data rows', () => {
    const code = artifact('refund'), test = testCase();
    test.metadata = { testCase: { ...(test.metadata as { testCase: object }).testCase, parameterized: true } };
    const result = deriver.derive(input([code], [test], [edge('tests', test, code, 'TESTS')]));
    expect(result.items[0].testArtifacts).toHaveLength(1);
    expect(result.items[0].testArtifacts[0].testCase).toHaveProperty('parameterized', true);
    expect(result.items[0].reason).toContain('source declaration');
    expect(result.summary.covered).toBe(1);
  });

  it('returns only impacted code rows with evidence-backed direct and indirect paths', () => {
    const cancel = artifact('cancel');
    const refund = artifact('refund');
    const data = artifact('booking', { artifactType: 'ENTITY', universalKind: 'DATA_MODEL' });
    const middle = artifact('intermediate');
    const test = testCase();
    const source = input([cancel, refund, data], [middle, test], [edge('tests', test, cancel, 'TESTS'),
      edge('calls-1', cancel, middle), edge('calls-2', middle, refund), edge('refs', cancel, data, 'REFERENCES')]);
    const result = qaCoverageResponseSchema.parse(deriver.derive(source));
    expect(result.items).toHaveLength(3);
    expect(result.summary).toEqual({ covered: 1, indirectOnly: 1, noTestFound: 1, highSeverityGaps: 0 });
    expect(result.traceContext).toMatchObject({ basis: 'STATIC_SOURCE_REFERENCE', commitSha: 'commit' });
    const direct = result.items.find(i => i.artifactId === 'cancel')!;
    expect(direct.status).toBe('COVERED');
    expect(direct.testArtifacts[0]).toMatchObject({ id: 'test', testCase: { title: 'cancels and refunds' },
      trace: { relation: 'DIRECT_REFERENCE', edges: [{ edgeId: 'tests', evidenceId: 'evidence-test' }] } });
    const indirect = result.items.find(i => i.artifactId === 'refund')!;
    expect(indirect.status).toBe('INDIRECT_ONLY');
    expect(indirect.testArtifacts[0].trace?.artifacts.map(a => a.id)).toEqual(['test', 'cancel', 'intermediate', 'refund']);
    expect(indirect.testArtifacts[0].trace?.edges.map(e => e.edgeId)).toEqual(['tests', 'calls-1', 'calls-2']);
    expect(indirect.confidenceNote).toContain('may be mocked');
    expect(JSON.stringify(result)).not.toContain('Redacted persisted source excerpt');
  });

  it('handles more than 50 impacted nodes and preserves unlinked intermediate callers', () => {
    const impacted = Array.from({ length: 75 }, (_, i) => artifact(`impact-${i}`));
    const caller = artifact('unlinked-caller');
    const test = testCase();
    const result = deriver.derive(input(impacted, [caller, test], [edge('test', test, caller, 'TESTS'),
      edge('call', caller, impacted[74])]));
    expect(result.items).toHaveLength(75);
    expect(result.items.find(i => i.artifactId === 'impact-74')?.status).toBe('INDIRECT_ONLY');
    expect(result.items.some(i => i.artifactId === caller.id)).toBe(false);
  });

  it.each(['SKIP', 'TODO'])('does not credit a %s case or its downstream calls', modifier => {
    const target = artifact('refund');
    const test = testCase('test', modifier);
    const result = deriver.derive(input([target], [test], [edge('tests', test, target, 'TESTS')]));
    expect(result.items[0]).toMatchObject({ status: 'NO_TEST_FOUND', testArtifacts: [] });
  });

  it.each(['file', 'no-metadata', 'foreign-case', 'foreign-edge', 'foreign-evidence', 'wrong-origin',
    'missing-evidence', 'wrong-range', 'wrong-path', 'wrong-source-type', 'invalid-provenance',
    'wrong-parent', 'wrong-provenance-key', 'wrong-resolver', 'invalid-confidence', 'empty-excerpt', 'artifact-range'])(
    'rejects unsupported evidence or identity: %s', variant => {
    const target = artifact('refund');
    const test = testCase();
    const link = edge('tests', test, target, 'TESTS');
    const source = input([target], [test], [link]);
    if (variant === 'file') test.artifactType = 'TEST';
    if (variant === 'no-metadata') test.metadata = null;
    if (variant === 'foreign-case') test.snapshotId = 'another-snapshot';
    if (variant === 'foreign-edge') link.snapshotId = 'another-snapshot';
    const ev = source.evidences.find(e => e.artifactId === test.id)!;
    if (variant === 'foreign-evidence') ev.snapshotId = 'another-snapshot';
    if (variant === 'wrong-origin') ev.artifactId = target.id;
    if (variant === 'missing-evidence') source.evidences = [];
    if (variant === 'wrong-range') ev.endLine = 4;
    if (variant === 'wrong-path') ev.sourcePath = target.filePath;
    if (variant === 'wrong-source-type') ev.sourceType = 'CODE';
    if (variant === 'invalid-provenance') link.metadata = {};
    if (variant === 'wrong-parent') test.metadata = { testCase: { ...(test.metadata as { testCase: object }).testCase,
      parentFileArtifactKey: 'test:src.other.spec.ts' } };
    if (variant === 'wrong-provenance-key') link.metadata = { ...(link.metadata as object), evidenceProvenanceKey: 'other-origin' };
    if (variant === 'wrong-resolver') link.metadata = { ...(link.metadata as object), resolver: 'TS_AST_ENTITY_REFERENCE' };
    if (variant === 'invalid-confidence') link.confidence = 1.5;
    if (variant === 'empty-excerpt') ev.excerpt = '   ';
    if (variant === 'artifact-range') test.endLine = 4;
    const result = deriver.derive(source);
    expect(result.items[0]).toMatchObject({ status: 'NO_TEST_FOUND', testArtifacts: [] });
    expect(result.traceContext?.limitations.length).toBeGreaterThan(0);
  });

  it('never propagates through a CALLS edge that lacks its own source evidence', () => {
    const target = artifact('refund'); const caller = artifact('cancel'); const test = testCase();
    const source = input([target], [caller, test], [edge('tests', test, caller, 'TESTS'), edge('call', caller, target)]);
    source.evidences = [evidence(test)];
    expect(deriver.derive(source).items[0].status).toBe('NO_TEST_FOUND');
  });

  it('terminates cycles, picks one shortest path per case and prefers direct references', () => {
    const target = artifact('refund'); const caller = artifact('cancel'); const test = testCase();
    const links = [edge('indirect', test, caller, 'TESTS'), edge('call', caller, target),
      edge('cycle', target, caller), edge('direct', test, target, 'TESTS')];
    const source = input([target], [caller, test], links);
    const result = deriver.derive(source);
    expect(result.items[0].status).toBe('COVERED');
    expect(result.items[0].testArtifacts).toHaveLength(1);
    expect(result.items[0].testArtifacts[0].trace?.edges.map(e => e.edgeId)).toEqual(['direct']);
    expect(deriver.derive({ ...source, edges: [...links].reverse() })).toEqual(result);
  });

  it('bounds call depth and case samples, exposing limits instead of implying complete coverage', () => {
    const chain = Array.from({ length: 6 }, (_, i) => artifact(`method-${i}`));
    const test = testCase();
    const links = chain.slice(0, -1).map((from, i) => edge(`call-${i}`, from, chain[i + 1]));
    links.push(edge('tests', test, chain[0], 'TESTS'));
    const tooDeep = deriver.derive(input([chain[5]], [...chain.slice(0, 5), test], links));
    expect(tooDeep.items[0].status).toBe('NO_TEST_FOUND');
    expect(tooDeep.traceContext?.limitations).toContain('CALL_DEPTH_LIMIT');
    const tests = Array.from({ length: 5 }, (_, i) => testCase(`test-${i}`));
    const capped = deriver.derive(input([chain[0]], tests, tests.map(t => edge(`test-${t.id}`, t, chain[0], 'TESTS'))));
    expect(capped.items[0]).toMatchObject({ status: 'COVERED', tracesTruncated: true });
    expect(capped.items[0].testArtifacts).toHaveLength(3);
    expect(capped.traceContext?.limitations).toContain('TRACE_SAMPLE_LIMIT');
  });

  it('preserves partial and legacy snapshot warnings even when no edges are found', () => {
    const source = input([artifact('refund')]);
    source.snapshot.coverageStatus = 'PARTIAL'; source.snapshot.analyzerVersion = 'analyzer@0.3.0';
    const result = deriver.derive(source);
    expect(result.traceContext?.limitations).toEqual(expect.arrayContaining(['SNAPSHOT_PARTIAL', 'LEGACY_TEST_IDENTITIES']));
    expect(result.items[0].reason).toContain('inspected');
  });

  it('preserves focused cases, confidence zero and scanner limitation diagnostics', () => {
    const target = artifact('cancel'), test = testCase('test', 'ONLY');
    const link = edge('test', test, target, 'TESTS'); link.confidence = 0;
    const source = input([target], [test], [link]);
    source.snapshot.diagnostics = [{ code: 'JEST_UNSUPPORTED_DECLARATION' }];
    const result = deriver.derive(source);
    expect(result.items[0].status).toBe('COVERED');
    expect(result.items[0].testArtifacts[0].trace?.edges[0].confidence).toBe(0);
    expect(result.traceContext?.limitations).toContain('SCANNER_LIMITATIONS');
  });
});
