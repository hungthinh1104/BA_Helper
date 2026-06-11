import { Injectable, Inject } from '@nestjs/common';
import OpenAI from 'openai';
import { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from '../domain/embedding-provider.interface';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;

@Injectable()
export class OpenAiEmbeddingProvider extends EmbeddingProvider {
  readonly providerName = 'openai';
  private readonly client: OpenAI;

  constructor() {
    super();
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const model = request.model ?? DEFAULT_MODEL;

    const response = await this.client.embeddings.create({
      model,
      input: request.texts,
      dimensions: DIMENSIONS,
    });

    return {
      embeddings: response.data.map((d) => d.embedding),
      model,
      dimensions: DIMENSIONS,
      tokenUsage: response.usage?.total_tokens ?? 0,
    };
  }
}
