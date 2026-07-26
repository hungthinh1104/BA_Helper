import { Module } from '@nestjs/common';
import { EmbeddingProviderPort, EmbedSnapshotArtifactsUseCase } from '@ba-helper/application';
import { FakeEmbeddingProvider } from './infrastructure/fake-embedding.provider';
import { OpenAiEmbeddingProvider } from './infrastructure/openai-embedding.provider';
import { GoogleEmbeddingProvider } from './infrastructure/google-embedding.provider';
import { EmbeddingChunkRepository } from './infrastructure/embedding-chunk.repository';
import { PrismaEmbeddingSnapshotRepository } from './infrastructure/prisma-embedding-snapshot.repository';
import { PrismaModule } from '../prisma/prisma.module';

import { resolveEmbeddingConfig } from '@ba-helper/shared';

@Module({
  imports: [PrismaModule],
  providers: [
    EmbeddingChunkRepository,
    PrismaEmbeddingSnapshotRepository,
    {
      provide: EmbedSnapshotArtifactsUseCase,
      useFactory: (chunkRepo, provider, snapshotRepo) => new EmbedSnapshotArtifactsUseCase(chunkRepo, provider, snapshotRepo),
      inject: [EmbeddingChunkRepository, EmbeddingProviderPort, PrismaEmbeddingSnapshotRepository],
    },
    {
      provide: EmbeddingProviderPort,
      useFactory: () => {
        // By default, use fake provider if not in production and not explicitly requested
        const config = resolveEmbeddingConfig(process.env);

        if (process.env.NODE_ENV === 'production' && config.provider === 'fake') {
          throw new Error('FakeEmbeddingProvider is forbidden in production. Please set EMBEDDING_PROVIDER.');
        }

        if (config.provider === 'openai') {
          return new OpenAiEmbeddingProvider(config);
        }
        if (config.provider === 'google') {
          return new GoogleEmbeddingProvider(config);
        }
        return new FakeEmbeddingProvider();
      },
    },
  ],
  exports: [EmbedSnapshotArtifactsUseCase, EmbeddingChunkRepository, EmbeddingProviderPort],
})
export class EmbeddingModule {}
