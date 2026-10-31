import type { EmbeddingConfig } from '@ba-helper/shared';
import type OpenAI from 'openai';
import { OpenAiEmbeddingProvider } from './openai-embedding.provider';

describe('OpenAiEmbeddingProvider model identity', () => {
  it('returns the model reported by the embedding response', async () => {
    const provider = new OpenAiEmbeddingProvider({
      provider: 'openai',
      apiKey: 'local-test-key',
    } satisfies EmbeddingConfig);
    const actualModel = 'text-embedding-3-small-resolved-version';
    const response: Awaited<ReturnType<OpenAI['embeddings']['create']>> = {
      object: 'list',
      data: [{
        object: 'embedding',
        index: 0,
        embedding: new Array(1536).fill(0.25),
      }],
      model: actualModel,
      usage: { prompt_tokens: 1, total_tokens: 1 },
    };
    const client = (provider as unknown as { client: OpenAI }).client;
    const createEmbedding = jest.spyOn(client.embeddings, 'create').mockResolvedValue(response);

    const result = await provider.embed({ texts: ['synthetic embedding input'] });

    expect(createEmbedding).toHaveBeenCalledWith({
      model: provider.modelName,
      input: ['synthetic embedding input'],
      dimensions: 1536,
    });
    expect(result.model).toBe(actualModel);
  });
});
