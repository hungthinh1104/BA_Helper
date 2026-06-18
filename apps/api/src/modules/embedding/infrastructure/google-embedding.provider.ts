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
import {
  mapWithConcurrency,
  withEmbeddingRetry,
} from '../domain/embedding-retry-policy';
import { QueryEmbeddingCacheService } from '../application/query-embedding-cache.service';

@Injectable()
export class GoogleEmbeddingProvider extends EmbeddingProvider {
  readonly providerName = 'google';
  private readonly client: GoogleGenerativeAI;
  private readonly logger = new Logger(GoogleEmbeddingProvider.name);
  private readonly queryCache = new QueryEmbeddingCacheService();
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

    const configHash = buildEmbeddingConfigHash(request.profile);
    let embeddingsResult: number[][] = [];
    try {
      this.logger.log(
        `Generating embeddings for ${request.texts.length} texts using model ${modelName} (Targeting ${request.profile.dimensions}d)`,
      );

      embeddingsResult = await this.embedTexts({
        model,
        request,
        taskType,
        configHash,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
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
      configHash,
      normalized: request.profile.normalize,
      tokenUsage: undefined,
    };
  }

  private async embedTexts(params: {
    model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
    request: EmbeddingRequest;
    taskType?: string;
    configHash: string;
  }): Promise<number[][]> {
    const results = new Array<number[]>(params.request.texts.length);
    const missing: Array<{ index: number; text: string }> = [];

    if (params.request.inputRole === 'QUERY') {
      for (const [index, text] of params.request.texts.entries()) {
        const cached = this.queryCache.get({
          profile: params.request.profile,
          configHash: params.configHash,
          text,
          inputRole: 'QUERY',
        });
        if (cached) {
          results[index] = cached;
          continue;
        }
        missing.push({ index, text });
      }
    } else {
      missing.push(
        ...params.request.texts.map((text, index) => ({ index, text })),
      );
    }

    for (let i = 0; i < missing.length; i += params.request.profile.batchSize) {
      const batch = missing.slice(i, i + params.request.profile.batchSize);
      const batchResults = await mapWithConcurrency(
        batch,
        params.request.profile.maxConcurrency,
        ({ text }) =>
          withEmbeddingRetry(
            {
              provider: this.providerName,
              model: params.request.profile.model,
              profile: params.request.profile,
              logger: (message) => this.logger.warn(message),
            },
            async () => {
              const result = await params.model.embedContent({
                content: { role: 'user', parts: [{ text }] },
                outputDimensionality:
                  params.request.profile.outputDimensionality ??
                  params.request.profile.dimensions,
                taskType: params.taskType,
              } as any);
              return result.embedding.values;
            },
          ),
      );

      batch.forEach(({ index, text }, batchIndex) => {
        results[index] = batchResults[batchIndex];
        if (params.request.inputRole === 'QUERY') {
          this.queryCache.set({
            profile: params.request.profile,
            configHash: params.configHash,
            text,
            inputRole: 'QUERY',
            embedding: batchResults[batchIndex],
          });
        }
      });
    }

    return results;
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
