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
  it('keeps historical file artifacts valid and suppresses malformed metadata', () => {
    expect(readTestCaseMetadata({ artifactType: 'TEST', metadata: { testCase } })).toBeUndefined();
    expect(readTestCaseMetadata({ artifactType: 'JEST_TEST_CASE', metadata: null })).toBeUndefined();
    expect(readTestCaseMetadata({ artifactType: 'JEST_TEST_CASE', metadata: { testCase: {} } })).toBeUndefined();
  });
});
