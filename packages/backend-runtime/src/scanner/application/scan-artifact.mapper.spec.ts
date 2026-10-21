import { buildArtifactInputs } from './scan-artifact.mapper';
import { buildEvidenceInputs } from './scan-persistence-mappers';
import type { ScanArtifact } from '@ba-helper/analyzer';

describe('test artifact persistence', () => {
  const parent: ScanArtifact = { stableId: 'test:payment.spec.ts', type: 'TEST', filePath: 'payment.spec.ts',
    symbolName: 'payment.spec.ts', startLine: 1, endLine: 12, excerpt: 'test file' };
  const test: ScanArtifact = { ...parent, stableId: 'test-case:payment.spec.ts::hash', type: 'JEST_TEST_CASE',
    symbolName: 'refund > once', testBodySpan: { start: 42, end: 57 },
    testCase: { framework: 'jest', suitePath: ['refund'], title: 'once', modifier: 'NORMAL',
      declaredModifier: 'NORMAL', parentFileArtifactKey: parent.stableId } };
  const collector = { add: jest.fn(), addSecretRedacted: jest.fn(), getItems: () => [] };

  it('stores a file and a case as different kinds and persists only validated case metadata', () => {
    const inputs = buildArtifactInputs('snapshot', [parent, test], collector);
    expect(inputs[0]).toMatchObject({ artifactType: 'TEST', universalKind: 'TEST_FILE' });
    expect(inputs[1]).toMatchObject({ artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE',
      metadata: { testCase: test.testCase } });
    expect(inputs[1]).not.toHaveProperty('testBodySpan');
  });

  it('redacts labels and classifies case evidence as TEST', () => {
    const secret = `ghp_${'a'.repeat(36)}`;
    const unsafe = { ...test, symbolName: secret, excerpt: `it('${secret}', () => {})`,
      testCase: { ...test.testCase!, title: secret, suitePath: [secret] } };
    const persisted = buildArtifactInputs('snapshot', [unsafe], collector);
    expect(JSON.stringify(persisted)).not.toContain(secret);
    const evidence = buildEvidenceInputs({ snapshotId: 'snapshot', artifacts: [unsafe],
      persistedArtifacts: [{ id: 'case-id', artifactKey: unsafe.stableId }], collector });
    expect(evidence[0].sourceType).toBe('TEST');
    expect(evidence[0].excerpt).not.toContain(secret);
  });

  it('rejects missing case metadata and cross-file parent relationships', () => {
    expect(() => buildArtifactInputs('snapshot', [{ ...test, testCase: undefined }], collector)).toThrow();
    expect(() => buildArtifactInputs('snapshot', [{ ...test,
      testCase: { ...test.testCase!, parentFileArtifactKey: 'test:other.spec.ts' } }], collector)).toThrow();
  });
});
