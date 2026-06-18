import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from '../domain/embedding-provider.interface';
import { AppError } from '../../../shared/app-error';
import { resolveGoogleProviderApiKey } from '../../ai/infrastructure/google-provider-env';
import type { EmbeddingProfile } from '../domain/embedding-profile';
import { resolveEmbeddingProfile } from '../domain/embedding-profile-registry';

@Injectable()
export class GoogleEmbeddingProvider extends EmbeddingProvider {
  readonly providerName = 'google';
  private readonly client: GoogleGenerativeAI;
  private readonly logger = new Logger(GoogleEmbeddingProvider.name);
  private readonly profile: EmbeddingProfile;

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
    const modelName = request.model ?? this.profile.model;
    const model = this.client.getGenerativeModel({ model: modelName });

    let embeddingsResult: number[][] = [];
    try {
      this.logger.log(`Generating embeddings for ${request.texts.length} texts using model ${modelName} (Targeting ${this.profile.dimensions}d)`);
      
      // Batch processing to avoid rate limits
      for (let i = 0; i < request.texts.length; i += this.profile.batchSize) {
        const batch = request.texts.slice(i, i + this.profile.batchSize);
        const results = await Promise.all(
          batch.map(t => 
            model.embedContent({ 
              content: { role: 'user', parts: [{ text: t }] }, 
              outputDimensionality: this.profile.outputDimensionality,
              taskType: this.profile.documentTaskType,
            } as any)
          )
        );
        embeddingsResult.push(...results.map(r => r.embedding.values));
      }
    } catch (e: any) {
      this.logger.error(`Failed to generate embeddings: ${e.message}`, e.stack);
      throw new AppError('EMBEDDING_PROVIDER_FAILED', `Google embedding API failed: ${e.message}`);
    }

    if (!embeddingsResult || embeddingsResult.length === 0) {
      throw new AppError('EMBEDDING_EMPTY_RESPONSE', 'Provider returned empty response');
    }

    // Strict dimension validation without any artificial padding
    for (const vector of embeddingsResult) {
      if (!vector || vector.length !== this.profile.dimensions) {
        throw new AppError(
          'EMBEDDING_DIMENSION_MISMATCH', 
          `Expected exactly ${this.profile.dimensions} dimensions, but got ${vector?.length}. Semantic padding is forbidden.`
        );
      }
    }

    return {
      embeddings: embeddingsResult,
      model: modelName,
      dimensions: this.profile.dimensions,
      tokenUsage: undefined, // Do not report 0 artificially
    };
  }
}
