import { Injectable, Inject } from '@nestjs/common';
import OpenAI from 'openai';
import { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from '../domain/embedding-provider.interface';
import { AppError, EmbeddingConfig } from '@ba-helper/shared';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;

@Injectable()
export class OpenAiEmbeddingProvider extends EmbeddingProvider {
  readonly providerName = 'openai';
  private readonly client: OpenAI;

  constructor(private readonly config: EmbeddingConfig) {
    super();
    this.client = new OpenAI({ apiKey: this.config.apiKey });
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const model = request.model ?? DEFAULT_MODEL;

    const response = await this.client.embeddings.create({
      model,
      input: request.texts,
      dimensions: DIMENSIONS,
    });

    for (const d of response.data) {
      if (d.embedding.length !== DIMENSIONS) {
        throw new AppError('EMBEDDING_DIMENSION_MISMATCH', 'Provider returned vector with incorrect dimension');
      }
    }

    return {
      embeddings: response.data.map((d) => d.embedding),
      model,
      dimensions: DIMENSIONS,
      tokenUsage: response.usage?.total_tokens ?? undefined,
    };
  }
}
