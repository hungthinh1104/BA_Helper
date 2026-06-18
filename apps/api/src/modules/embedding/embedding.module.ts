import { Module } from '@nestjs/common';
import { EmbeddingProvider } from './domain/embedding-provider.interface';
import { FakeEmbeddingProvider } from './infrastructure/fake-embedding.provider';
import { OpenAiEmbeddingProvider } from './infrastructure/openai-embedding.provider';
import { GoogleEmbeddingProvider } from './infrastructure/google-embedding.provider';
import { EmbeddingChunkRepository } from './infrastructure/embedding-chunk.repository';
import { EmbedSnapshotArtifactsUseCase } from './application/embed-snapshot-artifacts.usecase';
import { PrismaModule } from '../prisma/prisma.module';
import {
  resolveRuntimeEmbeddingProfileFromEnv,
} from './domain/embedding-profile-registry';

const EMBEDDING_PROVIDERS = ['fake', 'openai', 'google'] as const;
type EmbeddingProviderName = (typeof EMBEDDING_PROVIDERS)[number];

export function resolveEmbeddingProvider(rawProvider?: string): EmbeddingProviderName {
  const provider = (rawProvider || 'fake').trim().toLowerCase();
  if ((EMBEDDING_PROVIDERS as readonly string[]).includes(provider)) {
    return provider as EmbeddingProviderName;
  }
  throw new Error(`Unsupported EMBEDDING_PROVIDER "${rawProvider}". Expected one of: ${EMBEDDING_PROVIDERS.join(', ')}.`);
}

export function resolveSelectedEmbeddingProfile(kind: 'INDEX' | 'QUERY' = 'INDEX') {
  return resolveRuntimeEmbeddingProfileFromEnv(kind);
}

export function createEmbeddingProviderForProfile() {
  const profile = resolveSelectedEmbeddingProfile();
  const provider = profile.provider;
  const fakeAllowed =
    process.env.ALLOW_FAKE_EMBEDDING_IN_PRODUCTION?.trim().toLowerCase() ===
    'true';

  if (
    process.env.NODE_ENV === 'production' &&
    provider === 'fake' &&
    !fakeAllowed
  ) {
    throw new Error(
      'FakeEmbeddingProvider is forbidden in production. Please set an embedding profile/provider or ALLOW_FAKE_EMBEDDING_IN_PRODUCTION=true.',
    );
  }

  if (provider === 'openai') {
    return new OpenAiEmbeddingProvider(profile);
  }
  if (provider === 'google') {
    return new GoogleEmbeddingProvider(profile);
  }
  return new FakeEmbeddingProvider(profile);
}

@Module({
  imports: [PrismaModule],
  providers: [
    EmbeddingChunkRepository,
    EmbedSnapshotArtifactsUseCase,
    {
      provide: EmbeddingProvider,
      useFactory: () => createEmbeddingProviderForProfile(),
    },
  ],
  exports: [EmbedSnapshotArtifactsUseCase, EmbeddingChunkRepository, EmbeddingProvider],
})
export class EmbeddingModule {}
