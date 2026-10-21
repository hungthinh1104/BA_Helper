import { testCaseMetadataSchema } from './src';

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
});
