import { Injectable } from '@nestjs/common';
import { EmbeddingProviderPort, EmbeddingRequest, EmbeddingResult } from '@ba-helper/application';

/**
 * Deterministic fake embedding provider for tests.
 * Generates consistent pseudo-vectors based on text content hash
 * so tests are reproducible without calling an external API.
 */
@Injectable()
export class FakeEmbeddingProvider extends EmbeddingProviderPort {
  readonly providerName = 'fake';

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const dimensions = 1536;
    const embeddings = request.texts.map((text: string) => {
      // Generate deterministic pseudo-vector from text
      const vector = new Array(dimensions).fill(0);
      for (let i = 0; i < text.length && i < dimensions; i++) {
        vector[i % dimensions] += text.charCodeAt(i) / 1000;
      }
      // Normalize to unit vector
      const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
      return vector.map((v) => v / magnitude);
    });

    return {
      embeddings,
      model: 'fake-embedding',
      dimensions,
      tokenUsage: request.texts.reduce((sum: number, t: string) => sum + Math.ceil(t.length / 4), 0),
    };
  }
}
