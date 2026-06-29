import { Module } from '@nestjs/common';
import { HybridRetrievalService } from './application/hybrid-retrieval.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DomainPackModule } from '../domain-pack/domain-pack.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { ArtifactRepository } from '../artifact/infrastructure/artifact.repository';
import { GraphRepository } from '../graph/infrastructure/graph.repository';
import { EmbeddingChunkRepository } from '../embedding/infrastructure/embedding-chunk.repository';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule, DomainPackModule, EmbeddingModule],
  providers: [
    {
      provide: ArtifactRepository,
      useFactory: (prisma: PrismaService) => new ArtifactRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: GraphRepository,
      useFactory: (prisma: PrismaService) => new GraphRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: EmbeddingChunkRepository,
      useFactory: (prisma: PrismaService) => new EmbeddingChunkRepository(prisma),
      inject: [PrismaService],
    },
    HybridRetrievalService
  ],
  exports: [HybridRetrievalService],
})
export class RetrievalModule {}

