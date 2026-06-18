import { createHash } from 'node:crypto';
import type { EmbeddingProfile } from '../domain/embedding-profile';

type QueryCacheEntry = {
  profileId: string;
  configHash: string;
  dimensions: number;
  inputRole: 'QUERY';
  embedding: number[];
};

export class QueryEmbeddingCacheService {
  private static readonly store = new Map<string, QueryCacheEntry>();

  static clear(): void {
    QueryEmbeddingCacheService.store.clear();
  }

  buildKey(params: {
    profileId: string;
    configHash: string;
    text: string;
    inputRole: 'QUERY';
  }): string {
    const textHash = createHash('sha256').update(params.text).digest('hex');
    return `${params.profileId}:${params.configHash}:${params.inputRole}:${textHash}`;
  }

  get(params: {
    profile: EmbeddingProfile;
    configHash: string;
    text: string;
    inputRole: 'QUERY';
  }): number[] | null {
    const key = this.buildKey({
      profileId: params.profile.id,
      configHash: params.configHash,
      text: params.text,
      inputRole: params.inputRole,
    });
    const entry = QueryEmbeddingCacheService.store.get(key);
    if (!entry) {
      return null;
    }

    if (
      entry.profileId !== params.profile.id ||
      entry.configHash !== params.configHash ||
      entry.dimensions !== params.profile.dimensions ||
      entry.inputRole !== params.inputRole
    ) {
      QueryEmbeddingCacheService.store.delete(key);
      return null;
    }

    return [...entry.embedding];
  }

  set(params: {
    profile: EmbeddingProfile;
    configHash: string;
    text: string;
    inputRole: 'QUERY';
    embedding: number[];
  }): void {
    const key = this.buildKey({
      profileId: params.profile.id,
      configHash: params.configHash,
      text: params.text,
      inputRole: params.inputRole,
    });
    QueryEmbeddingCacheService.store.set(key, {
      profileId: params.profile.id,
      configHash: params.configHash,
      dimensions: params.profile.dimensions,
      inputRole: params.inputRole,
      embedding: [...params.embedding],
    });
  }

  primeForTest(
    key: string,
    entry: QueryCacheEntry,
  ): void {
    QueryEmbeddingCacheService.store.set(key, {
      ...entry,
      embedding: [...entry.embedding],
    });
  }
}
