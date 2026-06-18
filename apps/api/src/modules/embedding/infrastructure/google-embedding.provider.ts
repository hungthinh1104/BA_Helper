import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from '../domain/embedding-provider.interface';
import { AppError } from '../../../shared/app-error';
import { resolveGoogleProviderApiKey } from '../../ai/infrastructure/google-provider-env';
import type { EmbeddingProfile } from '../domain/embedding-profile';
import {
  buildEmbeddingConfigHash,
  resolveEmbeddingProfile,
} from '../domain/embedding-profile-registry';

@Injectable()
export class GoogleEmbeddingProvider extends EmbeddingProvider {
  readonly providerName = 'google';
  private readonly client: GoogleGenerativeAI;
  private readonly logger = new Logger(GoogleEmbeddingProvider.name);
  readonly profile: EmbeddingProfile;

  constructor(profile = resolveEmbeddingProfile('google-gemini-001-1536')) {
    super();
    this.profile = profile;
    const apiKey = resolveGoogleProviderApiKey();
    if (!apiKey) {
      throw new AppError(
        'AI_PROVIDER_CONFIG_INVALID',
        'Google embedding provider requires GOOGLE_API_KEY, GEMINI_API_KEY, or GOOGLE_AI_API_KEY.',
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    this.assertProfile(request.profile);
    const modelName = request.profile.model;
    const model = this.client.getGenerativeModel({ model: modelName });
    const taskType =
      request.inputRole === 'QUERY'
        ? request.profile.queryTaskType
        : request.profile.documentTaskType;

    let embeddingsResult: number[][] = [];
    try {
      this.logger.log(
        `Generating embeddings for ${request.texts.length} texts using model ${modelName} (Targeting ${request.profile.dimensions}d)`,
      );

      for (let i = 0; i < request.texts.length; i += request.profile.batchSize) {
        const batch = request.texts.slice(i, i + request.profile.batchSize);
        const results = await Promise.all(
          batch.map((text) =>
            model.embedContent({
              content: { role: 'user', parts: [{ text }] },
              outputDimensionality:
                request.profile.outputDimensionality ?? request.profile.dimensions,
              taskType,
            } as any),
          ),
        );
        embeddingsResult.push(...results.map((result) => result.embedding.values));
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to generate embeddings: ${error.message}`,
        error.stack,
      );
      throw new AppError(
        'EMBEDDING_PROVIDER_FAILED',
        `Google embedding API failed: ${error.message}`,
      );
    }

    if (!embeddingsResult || embeddingsResult.length === 0) {
      throw new AppError('EMBEDDING_EMPTY_RESPONSE', 'Provider returned empty response');
    }

    const normalizedVectors = embeddingsResult.map((vector) => {
      if (!vector || vector.length !== request.profile.dimensions) {
        throw new AppError(
          'EMBEDDING_DIMENSION_MISMATCH',
          `Expected exactly ${request.profile.dimensions} dimensions, but got ${vector?.length}. Semantic padding is forbidden.`,
        );
      }

      return request.profile.normalize ? this.normalize(vector) : vector;
    });

    return {
      embeddings: normalizedVectors,
      provider: this.providerName,
      model: modelName,
      dimensions: request.profile.dimensions,
      profileId: request.profile.id,
      configHash: buildEmbeddingConfigHash(request.profile),
      normalized: request.profile.normalize,
      tokenUsage: undefined,
    };
  }

  private assertProfile(profile: EmbeddingProfile): void {
    if (profile.provider !== this.providerName) {
      throw new AppError(
        'AI_PROVIDER_CONFIG_INVALID',
        `GoogleEmbeddingProvider requires provider "google", received "${profile.provider}".`,
      );
    }
  }

  private normalize(vector: number[]): number[] {
    const magnitude =
      Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / magnitude);
  }
}
