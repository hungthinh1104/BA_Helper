import {
  areEmbeddingProfilesCompatible,
  assertBenchmarkAllowedEmbeddingProfile,
  buildEmbeddingConfigHash,
  resolveEmbeddingProfile,
  resolveEmbeddingProfileFromEnv,
} from './embedding-profile-registry';

describe('embedding profile registry', () => {
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
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('resolves known profiles', () => {
    expect(resolveEmbeddingProfile('fake-1536').provider).toBe('fake');
    expect(resolveEmbeddingProfile('google-gemini-001-1536').provider).toBe('google');
    expect(resolveEmbeddingProfile('openai-3-small-1536').provider).toBe('openai');
    expect(resolveEmbeddingProfile('openai-3-large-1536').provider).toBe('openai');
  });

  it('rejects unknown profiles', () => {
    expect(() => resolveEmbeddingProfile('unknown-profile')).toThrow(
      'Unknown embedding profile "unknown-profile"',
    );
  });

  it('falls back safely to the default profile', () => {
    expect(resolveEmbeddingProfile().id).toBe('google-gemini-001-1536');
  });

  it('resolves index and query profile env vars', () => {
    process.env.EMBEDDING_INDEX_PROFILE = 'google-gemini-001-1536';
    process.env.EMBEDDING_QUERY_PROFILE = 'openai-3-small-1536';

    expect(resolveEmbeddingProfileFromEnv('INDEX').id).toBe('google-gemini-001-1536');
    expect(resolveEmbeddingProfileFromEnv('QUERY').id).toBe('openai-3-small-1536');
  });

  it('keeps EMBEDDING_PROVIDER as backward-compatible profile input', () => {
    process.env.EMBEDDING_PROVIDER = 'fake';
    expect(resolveEmbeddingProfile().id).toBe('fake-1536');

    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large';
    expect(resolveEmbeddingProfile().id).toBe('openai-3-large-1536');
  });

  it('marks fake profile as benchmark disallowed', () => {
    const profile = resolveEmbeddingProfile('fake-1536');

    expect(profile.benchmarkAllowed).toBe(false);
    expect(() => assertBenchmarkAllowedEmbeddingProfile(profile)).toThrow(
      'not allowed for benchmark export',
    );
  });

  it('defines required profile dimensions', () => {
    expect(resolveEmbeddingProfile('google-gemini-001-1536').dimensions).toBe(1536);
    expect(resolveEmbeddingProfile('openai-3-small-1536').dimensions).toBe(1536);
    expect(resolveEmbeddingProfile('openai-3-large-1536').dimensions).toBe(1536);
  });

  it('builds a stable config hash', () => {
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');

    expect(buildEmbeddingConfigHash(profile)).toBe(buildEmbeddingConfigHash({ ...profile }));
    expect(buildEmbeddingConfigHash(profile)).toHaveLength(64);
  });

  it('treats matching Google query/document profiles as compatible', () => {
    const query = resolveEmbeddingProfile('google-gemini-001-1536');
    const document = resolveEmbeddingProfile('google-gemini-001-1536');

    expect(areEmbeddingProfilesCompatible(query, document)).toBe(true);
  });

  it('rejects Google and OpenAI profiles even when dimensions match', () => {
    expect(
      areEmbeddingProfilesCompatible(
        resolveEmbeddingProfile('google-gemini-001-1536'),
        resolveEmbeddingProfile('openai-3-small-1536'),
      ),
    ).toBe(false);
  });

  it('rejects fake and real profiles for benchmark compatibility', () => {
    expect(
      areEmbeddingProfilesCompatible(
        resolveEmbeddingProfile('fake-1536'),
        resolveEmbeddingProfile('google-gemini-001-1536'),
      ),
    ).toBe(false);
  });
});
