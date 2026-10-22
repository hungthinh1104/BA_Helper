import { mapArtifactResponse, readTestCaseMetadata } from './artifact-response.mapper';

describe('test case API projection', () => {
  const testCase = { framework: 'jest', suitePath: ['refund'], title: 'once',
    modifier: 'SKIP', declaredModifier: 'NORMAL', parentFileArtifactKey: 'test:payment.spec.ts' };
  it('exposes validated case labels without internal metadata', () => {
    const dto = mapArtifactResponse({ id: 'id', artifactKey: 'key', name: 'once',
      artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE', filePath: 'payment.spec.ts',
      startLine: 3, endLine: 5, language: null, metadata: { testCase, internal: 'hidden' } });
    expect(dto.testCase).toEqual(testCase);
    expect(dto).not.toHaveProperty('metadata');
    expect(readTestCaseMetadata({ artifactType: 'JEST_TEST_CASE', metadata: { testCase } })).toEqual(testCase);
  });
  it('preserves validated static behavior provenance for artifact consumers', () => {
    const claim = { kind: 'ACTION', evidenceKind: 'STATIC_DECLARATION', sourceText: 'service.refund()',
      sourceLocation: { relativePath: 'payment.spec.ts', startOffset: 2, endOffset: 18,
        startLine: 1, startColumn: 3, endLine: 1, endColumn: 19 }, commitSha: 'commit-1',
      evidenceProvenanceKey: 'snapshot:snapshot-1:artifact:test:payment.spec.ts#file' };
    const dto = mapArtifactResponse({ id: 'id', artifactKey: 'case-key', name: 'refund',
      artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE', filePath: 'payment.spec.ts',
      startLine: 1, endLine: 1, language: null, metadata: { testCase: { ...testCase,
        parentFileArtifactKey: 'test:payment.spec.ts#file', behaviorEvidence: [claim] } } });
    expect(dto.testCase?.behaviorEvidence).toEqual([claim]);
  });
  it('keeps historical file artifacts valid and suppresses malformed metadata', () => {
    expect(readTestCaseMetadata({ artifactType: 'TEST', metadata: { testCase } })).toBeUndefined();
    expect(readTestCaseMetadata({ artifactType: 'JEST_TEST_CASE', metadata: null })).toBeUndefined();
    expect(readTestCaseMetadata({ artifactType: 'JEST_TEST_CASE', metadata: { testCase: {} } })).toBeUndefined();
  });
});
