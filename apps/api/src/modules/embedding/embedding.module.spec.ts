import { resolveEmbeddingProvider } from './embedding.module';

describe('resolveEmbeddingProvider', () => {
  it('normalizes whitespace and casing', () => {
    expect(resolveEmbeddingProvider('  GOOGLE ')).toBe('google');
  });

  it('fails fast on unsupported provider names', () => {
    expect(() => resolveEmbeddingProvider('azure')).toThrow(
      'Unsupported EMBEDDING_PROVIDER "azure"',
    );
  });
});
