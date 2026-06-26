import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../api/src/modules/prisma/prisma.module';
import { PrismaService } from '../../../api/src/modules/prisma/prisma.service';
import { ImpactAnalysisProcessor } from './impact-analysis.processor';
import { AiModule } from '../../../api/src/modules/ai/ai.module';
import { LlmProvider } from '../../../api/src/modules/ai/domain/llm-provider.interface';
import { RetrievalModule } from '../../../api/src/modules/retrieval/retrieval.module';
import { HybridRetrievalService } from '../../../api/src/modules/retrieval/application/hybrid-retrieval.service';
import { DomainPackModule } from '../../../api/src/modules/domain-pack/domain-pack.module';
import { ImpactAnalysisModule } from '../../../api/src/modules/impact-analysis/impact-analysis.module';
import { RunImpactAnalysisUseCase } from '@ba-helper/application';

@Module({
  imports: [PrismaModule, AiModule, RetrievalModule, DomainPackModule, ImpactAnalysisModule],
  providers: [
    ImpactAnalysisProcessor,
    {
      provide: RunImpactAnalysisUseCase,
      useExisting: RunImpactAnalysisUseCase,
    },
  ],
})
export class ImpactAnalysisWorkerModule {}

