import { Injectable } from '@nestjs/common';
import { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from '../domain/embedding-provider.interface';
import type { EmbeddingProfile } from '../domain/embedding-profile';
import { AppError } from '../../../shared/app-error';
import {
  buildEmbeddingConfigHash,
  resolveEmbeddingProfile,
} from '../domain/embedding-profile-registry';

/**
 * Deterministic fake embedding provider for tests.
 * Generates consistent pseudo-vectors based on text content hash
 * so tests are reproducible without calling an external API.
 */
@Injectable()
export class FakeEmbeddingProvider extends EmbeddingProvider {
  readonly providerName = 'fake';
  readonly profile: EmbeddingProfile;

  constructor(profile = resolveEmbeddingProfile('fake-1536')) {
    super();
    this.profile = profile;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    this.assertProfile(request.profile);
    const dimensions = request.profile.dimensions;
    const embeddings = request.texts.map((text) => {
      const vector = new Array(dimensions).fill(0);
      for (let i = 0; i < text.length && i < dimensions; i++) {
        vector[i % dimensions] += text.charCodeAt(i) / 1000;
      }
      const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
      return vector.map((v) => v / magnitude);
    });

    return {
      embeddings,
      provider: this.providerName,
      model: request.profile.model,
      dimensions,
      profileId: request.profile.id,
      configHash: buildEmbeddingConfigHash(request.profile),
      normalized: true,
      tokenUsage: request.texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
    };
  }

  private assertProfile(profile: EmbeddingProfile): void {
    if (profile.provider !== this.providerName) {
      throw new AppError(
        'AI_PROVIDER_CONFIG_INVALID',
        `FakeEmbeddingProvider requires provider "fake", received "${profile.provider}".`,
      );
    }
  }
}
