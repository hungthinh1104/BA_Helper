const mockEmbedContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  embedContent: mockEmbedContent,
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

import { resolveEmbeddingProfile } from '../domain/embedding-profile-registry';
import { GoogleEmbeddingProvider } from './google-embedding.provider';

describe('GoogleEmbeddingProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
    mockEmbedContent.mockReset();
    mockGetGenerativeModel.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses profile model and query task type', async () => {
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');
    mockEmbedContent.mockResolvedValue({
      embedding: { values: new Array(1536).fill(2) },
    });
    const provider = new GoogleEmbeddingProvider(profile);

    const result = await provider.embed({
      texts: ['find impacted booking route'],
      profile,
      inputRole: 'QUERY',
    });

    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: profile.model });
    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        outputDimensionality: 1536,
        taskType: profile.queryTaskType,
      }),
    );
    expect(result.provider).toBe('google');
    expect(result.model).toBe(profile.model);
    expect(result.profileId).toBe(profile.id);
    expect(result.dimensions).toBe(1536);
    expect(result.normalized).toBe(true);
  });

  it('normalizes vectors when profile.normalize is true', async () => {
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');
    const vector = new Array(1536).fill(0);
    vector[0] = 3;
    vector[1] = 4;
    mockEmbedContent.mockResolvedValue({ embedding: { values: vector } });
    const provider = new GoogleEmbeddingProvider(profile);

    const result = await provider.embed({
      texts: ['booking query'],
      profile,
      inputRole: 'DOCUMENT',
    });

    const magnitude = Math.sqrt(
      result.embeddings[0].reduce((sum, value) => sum + value * value, 0),
    );
    expect(magnitude).toBeCloseTo(1, 8);
  });

  it('validates exact vector dimensions', async () => {
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');
    mockEmbedContent.mockResolvedValue({
      embedding: { values: new Array(10).fill(1) },
    });
    const provider = new GoogleEmbeddingProvider(profile);

    await expect(
      provider.embed({
        texts: ['booking query'],
        profile,
        inputRole: 'DOCUMENT',
      }),
    ).rejects.toMatchObject({
      code: 'EMBEDDING_DIMENSION_MISMATCH',
    });
  });
});
