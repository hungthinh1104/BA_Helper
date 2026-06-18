import { FakeEmbeddingProvider } from './infrastructure/fake-embedding.provider';
import { GoogleEmbeddingProvider } from './infrastructure/google-embedding.provider';
import { OpenAiEmbeddingProvider } from './infrastructure/openai-embedding.provider';
import {
  createEmbeddingProviderForProfile,
  resolveEmbeddingProvider,
  resolveSelectedEmbeddingProfile,
} from './embedding.module';

describe('embedding.module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EMBEDDING_DEFAULT_PROFILE;
    delete process.env.EMBEDDING_INDEX_PROFILE;
    delete process.env.EMBEDDING_QUERY_PROFILE;
    delete process.env.EMBEDDING_PROVIDER;
    delete process.env.GOOGLE_EMBEDDING_MODEL;
    delete process.env.OPENAI_EMBEDDING_MODEL;
    delete process.env.ALLOW_FAKE_EMBEDDING_IN_PRODUCTION;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normalizes whitespace and casing for legacy provider names', () => {
    expect(resolveEmbeddingProvider('  GOOGLE ')).toBe('google');
  });

  it('fails fast on unsupported provider names', () => {
    expect(() => resolveEmbeddingProvider('azure')).toThrow(
      'Unsupported EMBEDDING_PROVIDER "azure"',
    );
  });

  it('resolves selected provider from EMBEDDING_INDEX_PROFILE', () => {
    process.env.EMBEDDING_INDEX_PROFILE = 'openai-3-large-1536';

    expect(resolveSelectedEmbeddingProfile().id).toBe('openai-3-large-1536');
  });

  it('keeps EMBEDDING_PROVIDER backward compatibility for google', () => {
    process.env.EMBEDDING_PROVIDER = 'google';

    expect(resolveSelectedEmbeddingProfile().id).toBe('google-gemini-001-1536');
  });

  it('creates a provider instance from the selected profile', () => {
    process.env.EMBEDDING_INDEX_PROFILE = 'fake-1536';

    expect(createEmbeddingProviderForProfile()).toBeInstanceOf(FakeEmbeddingProvider);
  });

  it('creates an OpenAI provider when profile selects OpenAI', () => {
    process.env.EMBEDDING_INDEX_PROFILE = 'openai-3-small-1536';
    process.env.OPENAI_API_KEY = 'test-key';

    expect(createEmbeddingProviderForProfile()).toBeInstanceOf(OpenAiEmbeddingProvider);
  });

  it('creates a Google provider when profile selects Google', () => {
    process.env.EMBEDDING_INDEX_PROFILE = 'google-gemini-001-1536';
    process.env.GEMINI_API_KEY = 'test-key';

    expect(createEmbeddingProviderForProfile()).toBeInstanceOf(
      GoogleEmbeddingProvider,
    );
  });

  it('rejects fake embedding in production unless explicitly allowed', () => {
    process.env.EMBEDDING_INDEX_PROFILE = 'fake-1536';
    process.env.NODE_ENV = 'production';

    expect(() => createEmbeddingProviderForProfile()).toThrow(
      'FakeEmbeddingProvider is forbidden in production',
    );
  });

  it('fails fast on unsupported profile ids', () => {
    process.env.EMBEDDING_INDEX_PROFILE = 'unknown-profile';

    expect(() => createEmbeddingProviderForProfile()).toThrow(
      'Unknown embedding profile "unknown-profile"',
    );
  });
});
