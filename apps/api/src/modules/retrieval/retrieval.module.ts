import { Module } from '@nestjs/common';
import { HybridRetrievalService } from './application/hybrid-retrieval.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { ArtifactModule } from '../artifact/artifact.module';
import { GraphModule } from '../graph/graph.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [EmbeddingModule, ArtifactModule, GraphModule, PrismaModule],
  providers: [HybridRetrievalService],
  exports: [HybridRetrievalService],
})
export class RetrievalModule {}
