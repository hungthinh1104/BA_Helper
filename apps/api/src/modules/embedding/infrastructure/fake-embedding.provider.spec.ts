import { resolveEmbeddingProfile } from '../domain/embedding-profile-registry';
import { FakeEmbeddingProvider } from './fake-embedding.provider';

describe('FakeEmbeddingProvider', () => {
  it('returns deterministic vectors and profile provenance', async () => {
    const profile = resolveEmbeddingProfile('fake-1536');
    const provider = new FakeEmbeddingProvider(profile);

    const first = await provider.embed({
      texts: ['booking cancellation'],
      profile,
      inputRole: 'DOCUMENT',
    });
    const second = await provider.embed({
      texts: ['booking cancellation'],
      profile,
      inputRole: 'QUERY',
    });

    expect(first.provider).toBe('fake');
    expect(first.model).toBe('fake-embedding');
    expect(first.profileId).toBe(profile.id);
    expect(first.normalized).toBe(true);
    expect(first.embeddings[0]).toEqual(second.embeddings[0]);
  });
});
