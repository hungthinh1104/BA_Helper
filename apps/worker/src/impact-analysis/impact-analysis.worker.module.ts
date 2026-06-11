import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../api/src/modules/prisma/prisma.module';
import { PrismaService } from '../../../api/src/modules/prisma/prisma.service';
import { ImpactAnalysisRepository } from '../../../api/src/modules/impact-analysis/infrastructure/impact-analysis.repository';
import { ArtifactRepository } from '../../../api/src/modules/artifact/infrastructure/artifact.repository';
import { EvidenceRepository } from '../../../api/src/modules/evidence/infrastructure/evidence.repository';
import { InsightRepository } from '../../../api/src/modules/insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../../api/src/modules/traceability/infrastructure/traceability.repository';
import { RunImpactAnalysisUseCase } from '../../../api/src/modules/impact-analysis/application/run-impact-analysis.usecase';
import { ImpactAnalysisProcessor } from './impact-analysis.processor';
import { AiModule } from '../../../api/src/modules/ai/ai.module';
import { LlmProvider } from '../../../api/src/modules/ai/domain/llm-provider.interface';
import { RetrievalModule } from '../../../api/src/modules/retrieval/retrieval.module';
import { HybridRetrievalService } from '../../../api/src/modules/retrieval/application/hybrid-retrieval.service';
import { DomainPackModule } from '../../../api/src/modules/domain-pack/domain-pack.module';

@Module({
  imports: [PrismaModule, AiModule, RetrievalModule, DomainPackModule],
  providers: [
    ImpactAnalysisProcessor,
    ImpactAnalysisRepository,
    ArtifactRepository,
    EvidenceRepository,
    InsightRepository,
    TraceabilityRepository,
    RunImpactAnalysisUseCase,
  ],
})
export class ImpactAnalysisWorkerModule {}
