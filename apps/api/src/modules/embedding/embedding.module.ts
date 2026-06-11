import { Module } from '@nestjs/common';
import { EmbeddingProvider } from './domain/embedding-provider.interface';
import { FakeEmbeddingProvider } from './infrastructure/fake-embedding.provider';
import { OpenAiEmbeddingProvider } from './infrastructure/openai-embedding.provider';
import { GoogleEmbeddingProvider } from './infrastructure/google-embedding.provider';
import { EmbeddingChunkRepository } from './infrastructure/embedding-chunk.repository';
import { EmbedSnapshotArtifactsUseCase } from './application/embed-snapshot-artifacts.usecase';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    EmbeddingChunkRepository,
    EmbedSnapshotArtifactsUseCase,
    {
      provide: EmbeddingProvider,
      useFactory: () => {
        // By default, use fake provider if not in production and not explicitly requested
        const provider = process.env.EMBEDDING_PROVIDER || 'fake';

        if (process.env.NODE_ENV === 'production' && provider === 'fake') {
          throw new Error('FakeEmbeddingProvider is forbidden in production. Please set EMBEDDING_PROVIDER.');
        }

        if (provider === 'openai') {
          return new OpenAiEmbeddingProvider();
        }
        if (provider === 'google') {
          return new GoogleEmbeddingProvider();
        }
        return new FakeEmbeddingProvider();
      },
    },
  ],
  exports: [EmbedSnapshotArtifactsUseCase, EmbeddingChunkRepository, EmbeddingProvider],
})
export class EmbeddingModule {}
