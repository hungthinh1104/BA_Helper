import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from '../domain/embedding-provider.interface';
import { AppError } from '../../../shared/app-error';
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
export class OpenAiEmbeddingProvider extends EmbeddingProvider {
  readonly providerName = 'openai';
  private readonly client: OpenAI;
  private readonly queryCache = new QueryEmbeddingCacheService();
  readonly profile: EmbeddingProfile;

  constructor(profile = resolveEmbeddingProfile('openai-3-small-1536')) {
    super();
    this.profile = profile;
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    this.assertProfile(request.profile);
    const model = request.profile.model;
    const configHash = buildEmbeddingConfigHash(request.profile);
    let response: { embeddings: number[][]; tokenUsage: number | undefined };
    try {
      response = await this.embedTexts({
        model,
        request,
        configHash,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'EMBEDDING_PROVIDER_FAILED',
        `OpenAI embedding API failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      embeddings: response.embeddings,
      provider: this.providerName,
      model,
      dimensions: request.profile.dimensions,
      profileId: request.profile.id,
      configHash,
      normalized: false,
      tokenUsage: response.tokenUsage,
    };
  }

  private async embedTexts(params: {
    model: string;
    request: EmbeddingRequest;
    configHash: string;
  }): Promise<{ embeddings: number[][]; tokenUsage: number | undefined }> {
    const results = new Array<number[]>(params.request.texts.length);
    const missing: Array<{ index: number; text: string }> = [];
    let tokenUsage = 0;

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

    const chunkedMissing: Array<Array<{ index: number; text: string }>> = [];
    for (let i = 0; i < missing.length; i += params.request.profile.batchSize) {
      chunkedMissing.push(missing.slice(i, i + params.request.profile.batchSize));
    }

    const chunkResults = await mapWithConcurrency(
      chunkedMissing,
      params.request.profile.maxConcurrency,
      async (batch) =>
        withEmbeddingRetry(
          {
            provider: this.providerName,
            model: params.model,
            profile: params.request.profile,
          },
          async () => {
            const response = await this.client.embeddings.create({
              model: params.model,
              input: batch.map((item) => item.text),
              dimensions: params.request.profile.dimensions,
            });

            return {
              embeddings: response.data.map((item) => item.embedding),
              tokenUsage: response.usage?.total_tokens ?? 0,
            };
          },
        ),
    );

    chunkResults.forEach((chunkResult, chunkIndex) => {
      tokenUsage += chunkResult.tokenUsage;
      chunkedMissing[chunkIndex].forEach(({ index, text }, vectorIndex) => {
        const vector = chunkResult.embeddings[vectorIndex];
        if (vector.length !== params.request.profile.dimensions) {
          throw new AppError(
            'EMBEDDING_DIMENSION_MISMATCH',
            'Provider returned vector with incorrect dimension',
          );
        }
        results[index] = vector;
        if (params.request.inputRole === 'QUERY') {
          this.queryCache.set({
            profile: params.request.profile,
            configHash: params.configHash,
            text,
            inputRole: 'QUERY',
            embedding: vector,
          });
        }
      });
    });

    return {
      embeddings: results,
      tokenUsage: tokenUsage || undefined,
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
