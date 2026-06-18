import { QueryEmbeddingCacheService } from './query-embedding-cache.service';
import { buildEmbeddingConfigHash, resolveEmbeddingProfile } from '../domain/embedding-profile-registry';

describe('QueryEmbeddingCacheService', () => {
  beforeEach(() => {
    QueryEmbeddingCacheService.clear();
  });

  it('cache key includes profileId, configHash, inputRole, and hashed text only', () => {
    const service = new QueryEmbeddingCacheService();
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');
    const configHash = buildEmbeddingConfigHash(profile);

    const key = service.buildKey({
      profileId: profile.id,
      configHash,
      text: 'cancel booking and issue refund',
      inputRole: 'QUERY',
    });

    expect(key).toContain(profile.id);
    expect(key).toContain(configHash);
    expect(key).toContain('QUERY');
    expect(key).not.toContain('cancel booking and issue refund');
  });

  it('returns cached query embedding when profile and dimensions match', () => {
    const service = new QueryEmbeddingCacheService();
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');
    const configHash = buildEmbeddingConfigHash(profile);

    service.set({
      profile,
      configHash,
      text: 'find impacted route',
      inputRole: 'QUERY',
      embedding: [0.1, 0.2, 0.3],
    });

    expect(
      service.get({
        profile,
        configHash,
        text: 'find impacted route',
        inputRole: 'QUERY',
      }),
    ).toEqual([0.1, 0.2, 0.3]);
  });

  it('refuses corrupted cache entries with wrong dimensions or profile metadata', () => {
    const service = new QueryEmbeddingCacheService();
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');
    const configHash = buildEmbeddingConfigHash(profile);
    const key = service.buildKey({
      profileId: profile.id,
      configHash,
      text: 'find impacted route',
      inputRole: 'QUERY',
    });

    service.primeForTest(key, {
      profileId: profile.id,
      configHash,
      dimensions: 999,
      inputRole: 'QUERY',
      embedding: [0.1, 0.2],
    });

    expect(
      service.get({
        profile,
        configHash,
        text: 'find impacted route',
        inputRole: 'QUERY',
      }),
    ).toBeNull();
  });
});
