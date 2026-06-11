import { Module } from '@nestjs/common';
import { ImpactAnalysisController } from './api/impact-analysis.controller';
import { CreateImpactAnalysisUseCase } from './application/create-impact-analysis.usecase';
import { GetImpactAnalysisUseCase } from './application/get-impact-analysis.usecase';
import { FinalizeImpactAnalysisUseCase } from './application/finalize-impact-analysis.usecase';
import { RunImpactAnalysisUseCase } from './application/run-impact-analysis.usecase';
import { ImpactAnalysisRepository } from './infrastructure/impact-analysis.repository';
import { RequirementRepository } from '../requirement/infrastructure/requirement.repository';
import { ArtifactRepository } from '../artifact/infrastructure/artifact.repository';
import { EvidenceRepository } from '../evidence/infrastructure/evidence.repository';
import { InsightRepository } from '../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../traceability/infrastructure/traceability.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventLogModule } from '../event-log/event-log.module';
import { EventLogService } from '../event-log/application/event-log.service';
import { DocumentModule } from '../document/document.module';
import { DocumentRepository } from '../document/infrastructure/document.repository';
import { QueueModule } from '../queue/queue.module';
import { QueueService } from '../queue/queue.service';
import { AiModule } from '../ai/ai.module';
import { LlmProvider } from '../ai/domain/llm-provider.interface';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { HybridRetrievalService } from '../retrieval/application/hybrid-retrieval.service';

@Module({
  imports: [PrismaModule, EventLogModule, DocumentModule, QueueModule, AiModule, RetrievalModule],
  controllers: [ImpactAnalysisController],
  providers: [
    ImpactAnalysisRepository,
    RequirementRepository,
    ArtifactRepository,
    EvidenceRepository,
    InsightRepository,
    TraceabilityRepository,
    CreateImpactAnalysisUseCase,
    GetImpactAnalysisUseCase,
    FinalizeImpactAnalysisUseCase,
    RunImpactAnalysisUseCase,
  ],
})
export class ImpactAnalysisModule {}
