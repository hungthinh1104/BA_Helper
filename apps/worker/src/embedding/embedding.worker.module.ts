import { Module } from '@nestjs/common';
import { EmbeddingProcessor } from './embedding.processor';
import { PrismaModule } from '../../../api/src/modules/prisma/prisma.module';
import { EmbeddingChunkRepository } from './infrastructure/embedding-chunk.repository';
import { PrismaEmbeddingSnapshotRepository } from './infrastructure/prisma-embedding-snapshot.repository';
import { FakeEmbeddingProvider } from './infrastructure/fake-embedding.provider';
import { OpenAiEmbeddingProvider } from './infrastructure/openai-embedding.provider';
import { GoogleEmbeddingProvider } from './infrastructure/google-embedding.provider';
import { EmbedSnapshotArtifactsUseCase, EmbeddingProviderPort } from '@ba-helper/application';
import { resolveEmbeddingConfig } from '@ba-helper/shared';

@Module({
  imports: [PrismaModule],
  providers: [
    EmbeddingProcessor,
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
})
export class EmbeddingWorkerModule {}
