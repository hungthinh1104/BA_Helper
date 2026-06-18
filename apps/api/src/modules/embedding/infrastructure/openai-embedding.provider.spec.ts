const mockCreate = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    embeddings: {
      create: mockCreate,
    },
  })),
}));

import { resolveEmbeddingProfile } from '../domain/embedding-profile-registry';
import { OpenAiEmbeddingProvider } from './openai-embedding.provider';
import { QueryEmbeddingCacheService } from '../application/query-embedding-cache.service';

describe('OpenAiEmbeddingProvider', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    QueryEmbeddingCacheService.clear();
  });

  it('passes profile model and dimensions explicitly', async () => {
    const profile = resolveEmbeddingProfile('openai-3-small-1536');
    mockCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.5) }],
      usage: { total_tokens: 42 },
    });
    const provider = new OpenAiEmbeddingProvider(profile);

    const result = await provider.embed({
      texts: ['booking validation change'],
      profile,
      inputRole: 'QUERY',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      model: profile.model,
      input: ['booking validation change'],
      dimensions: profile.dimensions,
    });
    expect(result.provider).toBe('openai');
    expect(result.model).toBe(profile.model);
    expect(result.dimensions).toBe(profile.dimensions);
    expect(result.normalized).toBe(false);
    expect(result.tokenUsage).toBe(42);
  });

  it('fails on mismatched dimensions', async () => {
    const profile = resolveEmbeddingProfile('openai-3-large-1536');
    mockCreate.mockResolvedValue({
      data: [{ embedding: new Array(10).fill(1) }],
      usage: { total_tokens: 1 },
    });
    const provider = new OpenAiEmbeddingProvider(profile);

    await expect(
      provider.embed({
        texts: ['booking validation change'],
        profile,
        inputRole: 'DOCUMENT',
      }),
    ).rejects.toMatchObject({
      code: 'EMBEDDING_DIMENSION_MISMATCH',
    });
  });

  it('retries rate limits and throws EMBEDDING_RATE_LIMITED after exhaustion', async () => {
    const profile = resolveEmbeddingProfile('openai-3-small-1536');
    mockCreate.mockRejectedValue({
      status: 429,
      message: 'rate limit hit',
    });
    const provider = new OpenAiEmbeddingProvider({ ...profile, maxRetries: 1 });

    await expect(
      provider.embed({
        texts: ['booking validation change'],
        profile: { ...profile, maxRetries: 1 },
        inputRole: 'QUERY',
      }),
    ).rejects.toMatchObject({
      code: 'EMBEDDING_RATE_LIMITED',
    });
  });
});
