import { assertArtifactPersistenceMatches, buildArtifactInputs } from './scan-artifact.mapper';
import { buildEvidenceInputs } from './scan-persistence-mappers';
import type { ScanArtifact } from '@ba-helper/analyzer';
import { createArtifactIdentity } from '@ba-helper/shared';

describe('test artifact persistence', () => {
  const parent: ScanArtifact = { stableId: createArtifactIdentity('test', 'payment.spec.ts', 'file'), type: 'TEST', filePath: 'payment.spec.ts',
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

  it('preserves the parameterized declaration flag in persisted JSON', () => {
    const parameterized = { ...test, testCase: { ...test.testCase!, parameterized: true } };
    const inputs = buildArtifactInputs('snapshot', [parameterized], collector);
    expect(inputs[0].metadata).toEqual({ testCase: parameterized.testCase });
  });

  it('redacts static behavior text and rejects claims that point outside their test file', () => {
    const secret = `ghp_${'b'.repeat(36)}`;
    const claim = { kind: 'INPUT' as const, evidenceKind: 'STATIC_DECLARATION' as const,
      sourceText: `const token = '${secret}'`, sourceLocation: { relativePath: 'payment.spec.ts',
        startOffset: 0, endOffset: 30, startLine: 1, startColumn: 1, endLine: 1, endColumn: 31 }, commitSha: 'commit-1' };
    const withClaim = { ...test, testCase: { ...test.testCase!, behaviorEvidence: [claim] } };
    const persisted = buildArtifactInputs('snapshot', [parent, withClaim], collector, 'commit-1');
    expect(JSON.stringify(persisted)).not.toContain(secret);
    expect(persisted[1].metadata).toMatchObject({ testCase: { behaviorEvidence: [{
      sourceLocation: claim.sourceLocation, commitSha: 'commit-1', evidenceKind: 'STATIC_DECLARATION',
      evidenceProvenanceKey: 'snapshot:snapshot:artifact:test:payment.spec.ts#file',
    }] } });
    expect(() => buildArtifactInputs('snapshot', [{ ...withClaim, testCase: { ...withClaim.testCase!,
      behaviorEvidence: [{ ...claim, sourceLocation: { ...claim.sourceLocation, relativePath: 'other.spec.ts' } }] } }], collector))
      .toThrow('reference its test case source file');
    expect(() => buildArtifactInputs('snapshot', [withClaim], collector, 'different-commit'))
      .toThrow('persisted snapshot commit');
    expect(() => buildArtifactInputs('snapshot', [parent, { ...withClaim, testCase: { ...withClaim.testCase!,
      behaviorEvidence: [{ ...claim, evidenceProvenanceKey: 'snapshot:other:artifact:case' }] } }], collector, 'commit-1'))
      .toThrow('persisted source evidence');
  });

  it('persists production code evidence with canonical locations and redacted excerpts', () => {
    const secret = `ghp_${'c'.repeat(36)}`;
    const production: ScanArtifact = {
      stableId: 'service-method:src/payment.service.ts#PaymentService.refund', type: 'SERVICE_METHOD',
      filePath: 'src/payment.service.ts', symbolName: 'PaymentService.refund', startLine: 4, endLine: 12,
      excerpt: 'refund(input: PaymentInput)', codeEvidence: {
        parameters: [{ name: 'input', typeText: 'PaymentInput', sourceText: 'input: PaymentInput', sourceLocation: {
          relativePath: 'src/payment.service.ts', startOffset: 80, endOffset: 98, startLine: 4, startColumn: 10, endLine: 4, endColumn: 28,
        } }],
        returnType: { text: 'Promise<Result>', sourceLocation: {
          relativePath: 'src/payment.service.ts', startOffset: 99, endOffset: 113, startLine: 4, startColumn: 29, endLine: 4, endColumn: 43,
        } },
        conditions: [{ kind: 'IF', sourceText: `input.enabled && '${secret}'`, sourceLocation: {
          relativePath: 'src/payment.service.ts', startOffset: 120, endOffset: 150, startLine: 5, startColumn: 5, endLine: 5, endColumn: 35,
        } }], exceptionHandlers: [],
      },
    };
    const [input] = buildArtifactInputs('snapshot', [production], collector);
    expect(input.metadata).toMatchObject({ codeEvidence: {
      parameters: [{ sourceText: 'input: PaymentInput', sourceLocation: { relativePath: 'src/payment.service.ts' } }],
      returnType: { text: 'Promise<Result>' }, conditions: [{ kind: 'IF' }],
    } });
    expect(JSON.stringify(input.metadata)).not.toContain(secret);
  });

  it('rejects duplicate identities before persistence', () => {
    expect(() => buildArtifactInputs('snapshot', [parent, { ...parent, symbolName: 'other' }], collector))
      .toThrow('share the same stable identity');
  });

  it('rejects a persisted row whose identity conflicts with extracted source data', () => {
    const [input] = buildArtifactInputs('snapshot', [parent], collector);
    expect(() => assertArtifactPersistenceMatches([input], [{
      id: 'artifact-id', ...input, startLine: input.startLine ?? null, endLine: input.endLine ?? null,
      contentHash: 'older-content-hash', metadata: null,
    }])).toThrow('conflicts with its extracted identity');
  });

  it('rejects extra stale rows from an earlier write to the same snapshot identity', () => {
    const [input] = buildArtifactInputs('snapshot', [parent], collector);
    expect(() => assertArtifactPersistenceMatches([input], [
      { id: 'artifact-id', ...input, startLine: input.startLine ?? null, endLine: input.endLine ?? null,
        contentHash: input.contentHash ?? null, metadata: null },
      { id: 'stale-id', ...input, artifactKey: 'stale-artifact-key', startLine: input.startLine ?? null,
        endLine: input.endLine ?? null, contentHash: input.contentHash ?? null, metadata: null },
    ])).toThrow('identities conflict with the extracted snapshot');
  });
});
