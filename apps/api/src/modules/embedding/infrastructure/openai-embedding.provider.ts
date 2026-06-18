import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from '../domain/embedding-provider.interface';
import { AppError } from '../../../shared/app-error';
import type { EmbeddingProfile } from '../domain/embedding-profile';
import { resolveEmbeddingProfile } from '../domain/embedding-profile-registry';

@Injectable()
export class OpenAiEmbeddingProvider extends EmbeddingProvider {
  readonly providerName = 'openai';
  private readonly client: OpenAI;
  private readonly profile: EmbeddingProfile;

  constructor(profile = resolveEmbeddingProfile('openai-3-small-1536')) {
    super();
    this.profile = profile;
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const model = request.model ?? this.profile.model;

    const response = await this.client.embeddings.create({
      model,
      input: request.texts,
      dimensions: this.profile.outputDimensionality,
    });

    for (const d of response.data) {
      if (d.embedding.length !== this.profile.dimensions) {
        throw new AppError('EMBEDDING_DIMENSION_MISMATCH', 'Provider returned vector with incorrect dimension');
      }
    }

    return {
      embeddings: response.data.map((d) => d.embedding),
      model,
      dimensions: this.profile.dimensions,
      tokenUsage: response.usage?.total_tokens ?? undefined,
    };
  }
}
