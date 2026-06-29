import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmbeddingProviderPort, EmbeddingRequest, EmbeddingResult } from '@ba-helper/application';
import { AppError, EmbeddingConfig } from '@ba-helper/shared';

const DEFAULT_MODEL = 'gemini-embedding-001';
const EXPECTED_DIMENSIONS = 1536;
const CONCURRENCY_LIMIT = 5;

@Injectable()
export class GoogleEmbeddingProvider extends EmbeddingProviderPort {
  readonly providerName = 'google';
  private readonly client: GoogleGenerativeAI;
  private readonly logger = new Logger(GoogleEmbeddingProvider.name);

  constructor(private readonly config: EmbeddingConfig) {
    super();
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new AppError(
        'AI_PROVIDER_CONFIG_INVALID',
        'Google embedding provider requires GOOGLE_API_KEY, GEMINI_API_KEY, or GOOGLE_AI_API_KEY.',
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const modelName = request.model ?? DEFAULT_MODEL;
    const model = this.client.getGenerativeModel({ model: modelName });

    let embeddingsResult: number[][] = [];
    try {
      this.logger.log(`Generating embeddings for ${request.texts.length} texts using model ${modelName} (Targeting ${EXPECTED_DIMENSIONS}d)`);
      
      // Batch processing to avoid rate limits
      for (let i = 0; i < request.texts.length; i += CONCURRENCY_LIMIT) {
        const batch = request.texts.slice(i, i + CONCURRENCY_LIMIT);
        const results = await Promise.all(
          batch.map((t: string) => 
            // We pass outputDimensionality to force the vector size to exactly 1536
            model.embedContent({ 
              content: { role: 'user', parts: [{ text: t }] }, 
              outputDimensionality: EXPECTED_DIMENSIONS 
            } as any)
          )
        );
        embeddingsResult.push(...results.map((r: any) => r.embedding.values));
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
      if (!vector || vector.length !== EXPECTED_DIMENSIONS) {
        throw new AppError(
          'EMBEDDING_DIMENSION_MISMATCH', 
          `Expected exactly ${EXPECTED_DIMENSIONS} dimensions, but got ${vector?.length}. Semantic padding is forbidden.`
        );
      }
    }

    return {
      embeddings: embeddingsResult,
      model: modelName,
      dimensions: EXPECTED_DIMENSIONS,
      tokenUsage: undefined, // Do not report 0 artificially
    };
  }
}
