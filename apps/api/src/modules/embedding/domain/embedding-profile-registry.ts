import { createHash } from 'node:crypto';
import { AppError } from '../../../shared/app-error';
import type { EmbeddingProfile } from './embedding-profile';

export const EMBEDDING_PROFILES = {
  'fake-1536': {
    id: 'fake-1536',
    provider: 'fake',
    model: 'fake-embedding',
    dimensions: 1536,
    normalize: true,
    distanceMetric: 'cosine',
    batchSize: 64,
    maxConcurrency: 1,
    maxRetries: 0,
    isFake: true,
    benchmarkAllowed: false,
  },
  'google-gemini-001-1536': {
    id: 'google-gemini-001-1536',
    provider: 'google',
    model: 'gemini-embedding-001',
    dimensions: 1536,
    outputDimensionality: 1536,
    documentTaskType: 'RETRIEVAL_DOCUMENT',
    queryTaskType: 'CODE_RETRIEVAL_QUERY',
    normalize: true,
    distanceMetric: 'cosine',
    batchSize: 5,
    // Lower default concurrency reduces 429/quota instability in reproducible research runs.
    maxConcurrency: 1,
    maxRetries: 3,
    isFake: false,
    benchmarkAllowed: true,
  },
  'openai-3-small-1536': {
    id: 'openai-3-small-1536',
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    outputDimensionality: 1536,
    documentTaskType: 'DEFAULT',
    queryTaskType: 'DEFAULT',
    normalize: false,
    distanceMetric: 'cosine',
    batchSize: 256,
    maxConcurrency: 1,
    maxRetries: 3,
    isFake: false,
    benchmarkAllowed: true,
  },
  'openai-3-large-1536': {
    id: 'openai-3-large-1536',
    provider: 'openai',
    model: 'text-embedding-3-large',
    dimensions: 1536,
    outputDimensionality: 1536,
    documentTaskType: 'DEFAULT',
    queryTaskType: 'DEFAULT',
    normalize: false,
    distanceMetric: 'cosine',
    batchSize: 256,
    maxConcurrency: 1,
    maxRetries: 3,
    isFake: false,
    benchmarkAllowed: true,
  },
} as const satisfies Record<string, EmbeddingProfile>;

export type EmbeddingProfileId = keyof typeof EMBEDDING_PROFILES;

const DEFAULT_PROFILE_ID: EmbeddingProfileId = 'google-gemini-001-1536';

function cloneProfile(profile: EmbeddingProfile): EmbeddingProfile {
  return { ...profile };
}

function envOrEmpty(name: string): string {
  return (process.env[name] ?? '').trim();
}

function resolveLegacyProviderProfile(): EmbeddingProfileId | null {
  const provider = envOrEmpty('EMBEDDING_PROVIDER').toLowerCase();

  if (provider === 'fake') {
    return 'fake-1536';
  }

  if (provider === 'google') {
    const legacyModel = envOrEmpty('GOOGLE_EMBEDDING_MODEL');
    if (!legacyModel || legacyModel === 'gemini-embedding-001') {
      return 'google-gemini-001-1536';
    }
  }

  if (provider === 'openai') {
    const legacyModel = envOrEmpty('OPENAI_EMBEDDING_MODEL');
    if (!legacyModel || legacyModel === 'text-embedding-3-small') {
      return 'openai-3-small-1536';
    }
    if (legacyModel === 'text-embedding-3-large') {
      return 'openai-3-large-1536';
    }
  }

  return null;
}

export function resolveEmbeddingProfile(profileId?: string): EmbeddingProfile {
  const id = (profileId ?? '').trim();
  const selectedId = id || resolveLegacyProviderProfile() || envOrEmpty('EMBEDDING_DEFAULT_PROFILE') || DEFAULT_PROFILE_ID;
  const profile = EMBEDDING_PROFILES[selectedId as EmbeddingProfileId];

  if (!profile) {
    throw new AppError(
      'AI_PROVIDER_CONFIG_INVALID',
      `Unknown embedding profile "${selectedId}". Expected one of: ${Object.keys(EMBEDDING_PROFILES).join(', ')}.`,
    );
  }

  return cloneProfile(profile);
}

export function resolveEmbeddingProfileFromEnv(kind: 'INDEX' | 'QUERY'): EmbeddingProfile {
  const explicit =
    kind === 'INDEX'
      ? envOrEmpty('EMBEDDING_INDEX_PROFILE')
      : envOrEmpty('EMBEDDING_QUERY_PROFILE');

  return resolveEmbeddingProfile(explicit || undefined);
}

export function resolveRuntimeEmbeddingProfileFromEnv(
  kind: 'INDEX' | 'QUERY',
): EmbeddingProfile {
  const explicit =
    kind === 'INDEX'
      ? envOrEmpty('EMBEDDING_INDEX_PROFILE')
      : envOrEmpty('EMBEDDING_QUERY_PROFILE');

  if (explicit) {
    return resolveEmbeddingProfile(explicit);
  }

  if (envOrEmpty('EMBEDDING_DEFAULT_PROFILE')) {
    return resolveEmbeddingProfile(envOrEmpty('EMBEDDING_DEFAULT_PROFILE'));
  }

  if (envOrEmpty('EMBEDDING_PROVIDER')) {
    return resolveEmbeddingProfile();
  }

  return resolveEmbeddingProfile('fake-1536');
}

export function buildEmbeddingConfigHash(profile: EmbeddingProfile): string {
  const stablePayload = {
    provider: profile.provider,
    model: profile.model,
    dimensions: profile.dimensions,
    outputDimensionality: profile.outputDimensionality ?? null,
    documentTaskType: profile.documentTaskType ?? null,
    queryTaskType: profile.queryTaskType ?? null,
    normalize: profile.normalize,
    distanceMetric: profile.distanceMetric,
  };

  return createHash('sha256')
    .update(JSON.stringify(stablePayload))
    .digest('hex');
}

export function assertBenchmarkAllowedEmbeddingProfile(profile: EmbeddingProfile): void {
  if (!profile.benchmarkAllowed || profile.isFake) {
    throw new AppError(
      'AI_PROVIDER_CONFIG_INVALID',
      `Embedding profile "${profile.id}" is not allowed for benchmark export.`,
    );
  }
}

export function areEmbeddingProfilesCompatible(
  queryProfile: EmbeddingProfile,
  documentProfile: EmbeddingProfile,
): boolean {
  if (queryProfile.isFake || documentProfile.isFake) {
    return false;
  }

  return (
    queryProfile.provider === documentProfile.provider &&
    queryProfile.model === documentProfile.model &&
    queryProfile.dimensions === documentProfile.dimensions &&
    queryProfile.distanceMetric === documentProfile.distanceMetric
  );
}
