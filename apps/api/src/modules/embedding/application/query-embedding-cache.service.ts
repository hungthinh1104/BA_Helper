import { createHash } from 'node:crypto';
import type { EmbeddingProfile } from '../domain/embedding-profile';

type QueryCacheEntry = {
  profileId: string;
  configHash: string;
  dimensions: number;
  inputRole: 'QUERY';
  embedding: number[];
  expiresAt: number;
  lastAccessedAt: number;
};

export class QueryEmbeddingCacheService {
  private static readonly store = new Map<string, QueryCacheEntry>();

  constructor(
    private readonly options: {
      maxEntries?: number;
      ttlMs?: number;
      now?: () => number;
    } = {},
  ) {}

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
    this.expireEntries();
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

    const now = this.now();
    if (entry.expiresAt <= now) {
      QueryEmbeddingCacheService.store.delete(key);
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

    entry.lastAccessedAt = now;
    return [...entry.embedding];
  }

  set(params: {
    profile: EmbeddingProfile;
    configHash: string;
    text: string;
    inputRole: 'QUERY';
    embedding: number[];
  }): void {
    this.expireEntries();
    const key = this.buildKey({
      profileId: params.profile.id,
      configHash: params.configHash,
      text: params.text,
      inputRole: params.inputRole,
    });
    const now = this.now();
    QueryEmbeddingCacheService.store.set(key, {
      profileId: params.profile.id,
      configHash: params.configHash,
      dimensions: params.profile.dimensions,
      inputRole: params.inputRole,
      embedding: [...params.embedding],
      expiresAt: now + this.ttlMs(),
      lastAccessedAt: now,
    });
    this.evictOverflow();
  }

  primeForTest(
    key: string,
    entry: Omit<Partial<QueryCacheEntry>, 'embedding'> & {
      profileId: string;
      configHash: string;
      dimensions: number;
      inputRole: 'QUERY';
      embedding: number[];
    },
  ): void {
    const now = this.now();
    QueryEmbeddingCacheService.store.set(key, {
      ...entry,
      embedding: [...entry.embedding],
      expiresAt: entry.expiresAt ?? now + this.ttlMs(),
      lastAccessedAt: entry.lastAccessedAt ?? now,
    });
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private maxEntries(): number {
    const raw = this.options.maxEntries ?? Number(process.env.EMBEDDING_QUERY_CACHE_MAX_ENTRIES);
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1000;
  }

  private ttlMs(): number {
    const raw = this.options.ttlMs ?? Number(process.env.EMBEDDING_QUERY_CACHE_TTL_MS);
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 10 * 60 * 1000;
  }

  private expireEntries(): void {
    const now = this.now();
    for (const [key, entry] of QueryEmbeddingCacheService.store.entries()) {
      if (entry.expiresAt <= now) {
        QueryEmbeddingCacheService.store.delete(key);
      }
    }
  }

  private evictOverflow(): void {
    const maxEntries = this.maxEntries();
    while (QueryEmbeddingCacheService.store.size > maxEntries) {
      const oldest = Array.from(QueryEmbeddingCacheService.store.entries()).sort(
        ([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt,
      )[0];
      if (!oldest) return;
      QueryEmbeddingCacheService.store.delete(oldest[0]);
    }
  }
}
