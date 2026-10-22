import { scanTestCaseMetadataSchema, testCaseMetadataSchema } from './src';

describe('source test declaration metadata', () => {
  const literal = { framework: 'jest', suitePath: ['Payment'], title: 'refund %s',
    modifier: 'NORMAL', declaredModifier: 'NORMAL', parentFileArtifactKey: 'test:payment.spec.ts' };

  it('preserves historical metadata without adding a parameterized flag', () => {
    expect(testCaseMetadataSchema.parse(literal)).toEqual(literal);
  });

  it('preserves an explicit parameterized source flag and rejects malformed values', () => {
    expect(testCaseMetadataSchema.parse({ ...literal, parameterized: true })).toEqual({ ...literal, parameterized: true });
    expect(testCaseMetadataSchema.safeParse({ ...literal, parameterized: 'true' }).success).toBe(false);
  });

  it('validates static behavior claims with bounded source and commit provenance', () => {
    const claim = { kind: 'EXPECTED_OUTCOME', evidenceKind: 'STATIC_DECLARATION', sourceText: "'refunded'",
      sourceLocation: { relativePath: 'test/refund.spec.ts', startOffset: 30, endOffset: 40,
        startLine: 2, startColumn: 10, endLine: 2, endColumn: 20 }, commitSha: 'abc123',
      evidenceProvenanceKey: 'snapshot:snapshot:artifact:test:test/refund.spec.ts#file' };
    expect(testCaseMetadataSchema.parse({ ...literal, behaviorEvidence: [claim] })).toMatchObject({ behaviorEvidence: [claim] });
    expect(testCaseMetadataSchema.safeParse({ ...literal, behaviorEvidence: [{ ...claim, commitSha: '' }] }).success).toBe(false);
    expect(testCaseMetadataSchema.safeParse({ ...literal, behaviorEvidence: [{ ...claim,
      sourceLocation: { ...claim.sourceLocation, relativePath: '../outside.spec.ts' } }] }).success).toBe(false);
    const scanClaim = { ...claim };
    delete (scanClaim as { evidenceProvenanceKey?: string }).evidenceProvenanceKey;
    expect(scanTestCaseMetadataSchema.parse({ ...literal, behaviorEvidence: [scanClaim] }).behaviorEvidence?.[0])
      .not.toHaveProperty('evidenceProvenanceKey');
    expect(testCaseMetadataSchema.safeParse({ ...literal, behaviorEvidence: [scanClaim] }).success).toBe(false);
  });
});
