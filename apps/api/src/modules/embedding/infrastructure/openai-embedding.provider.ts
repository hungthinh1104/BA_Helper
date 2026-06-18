import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from '../domain/embedding-provider.interface';
import { AppError } from '../../../shared/app-error';
import type { EmbeddingProfile } from '../domain/embedding-profile';
import {
  buildEmbeddingConfigHash,
  resolveEmbeddingProfile,
} from '../domain/embedding-profile-registry';

@Injectable()
export class OpenAiEmbeddingProvider extends EmbeddingProvider {
  readonly providerName = 'openai';
  private readonly client: OpenAI;
  readonly profile: EmbeddingProfile;

  constructor(profile = resolveEmbeddingProfile('openai-3-small-1536')) {
    super();
    this.profile = profile;
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    this.assertProfile(request.profile);
    const model = request.profile.model;

    const response = await this.client.embeddings.create({
      model,
      input: request.texts,
      dimensions: request.profile.dimensions,
    });

    for (const d of response.data) {
      if (d.embedding.length !== request.profile.dimensions) {
        throw new AppError('EMBEDDING_DIMENSION_MISMATCH', 'Provider returned vector with incorrect dimension');
      }
    }

    return {
      embeddings: response.data.map((d) => d.embedding),
      provider: this.providerName,
      model,
      dimensions: request.profile.dimensions,
      profileId: request.profile.id,
      configHash: buildEmbeddingConfigHash(request.profile),
      normalized: false,
      tokenUsage: response.usage?.total_tokens ?? undefined,
    };
  }

  private assertProfile(profile: EmbeddingProfile): void {
    if (profile.provider !== this.providerName) {
      throw new AppError(
        'AI_PROVIDER_CONFIG_INVALID',
        `OpenAiEmbeddingProvider requires provider "openai", received "${profile.provider}".`,
      );
    }
  }
}
