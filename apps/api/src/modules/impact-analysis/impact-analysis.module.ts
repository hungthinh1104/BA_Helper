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
    {
      provide: ImpactAnalysisRepository,
      useFactory: (prisma: PrismaService) => new ImpactAnalysisRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: RequirementRepository,
      useFactory: (prisma: PrismaService) => new RequirementRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ArtifactRepository,
      useFactory: (prisma: PrismaService) => new ArtifactRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: EvidenceRepository,
      useFactory: (prisma: PrismaService) => new EvidenceRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: InsightRepository,
      useFactory: (prisma: PrismaService) => new InsightRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: TraceabilityRepository,
      useFactory: (prisma: PrismaService) => new TraceabilityRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateImpactAnalysisUseCase,
      useFactory: (
        repo: ImpactAnalysisRepository,
        requirementRepo: RequirementRepository,
        prisma: PrismaService,
        eventLog: EventLogService,
        queue: QueueService,
      ) =>
        new CreateImpactAnalysisUseCase(
          repo,
          requirementRepo,
          prisma,
          eventLog,
          queue,
        ),
      inject: [
        ImpactAnalysisRepository,
        RequirementRepository,
        PrismaService,
        EventLogService,
        QueueService,
      ],
    },
    {
      provide: GetImpactAnalysisUseCase,
      useFactory: (repo: ImpactAnalysisRepository) =>
        new GetImpactAnalysisUseCase(repo),
      inject: [ImpactAnalysisRepository],
    },
    {
      provide: RunImpactAnalysisUseCase,
      useFactory: (
        repo: ImpactAnalysisRepository,
        artifactRepo: ArtifactRepository,
        evidenceRepo: EvidenceRepository,
        insightRepo: InsightRepository,
        traceabilityRepo: TraceabilityRepository,
        llmProvider: LlmProvider,
        retrievalService: HybridRetrievalService,
      ) =>
        new RunImpactAnalysisUseCase(
          repo,
          artifactRepo,
          evidenceRepo,
          insightRepo,
          traceabilityRepo,
          llmProvider,
          retrievalService,
        ),
      inject: [
        ImpactAnalysisRepository,
        ArtifactRepository,
        EvidenceRepository,
        InsightRepository,
        TraceabilityRepository,
        LlmProvider,
        HybridRetrievalService,
      ],
    },
    {
      provide: FinalizeImpactAnalysisUseCase,
      useFactory: (
        repo: ImpactAnalysisRepository,
        docRepo: DocumentRepository,
        eventLog: EventLogService,
      ) => new FinalizeImpactAnalysisUseCase(repo, docRepo, eventLog),
      inject: [ImpactAnalysisRepository, 'DocumentRepository', EventLogService],
    },
  ],
})
export class ImpactAnalysisModule {}
