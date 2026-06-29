import { Module } from '@nestjs/common';
import { ImpactAnalysisProcessor } from './impact-analysis.processor';
import {
  RunImpactAnalysisUseCase,
  ImpactEvidenceCollectionStep,
  ImpactDiagnosticPropagationStep,
  ImpactAiReasoningStep,
  LlmProviderPort,
} from '@ba-helper/application';
// v0.1: use API PrismaModule/PrismaService so repository constructors receive the correct type.
// Worker-local PrismaModule is only for modules with worker-only infrastructure (embedding).
import { PrismaModule } from '@ba-helper/api/modules/prisma/prisma.module';
import { PrismaService } from '@ba-helper/api/modules/prisma/prisma.service';

// Infrastructure repositories imported from apps/api (no controller leak — pure infrastructure)
import { ImpactAnalysisRepository } from '@ba-helper/api/modules/impact-analysis/infrastructure/impact-analysis.repository';
import { InsightRepository } from '@ba-helper/api/modules/insight/infrastructure/insight.repository';
import { ArtifactRepository } from '@ba-helper/api/modules/artifact/infrastructure/artifact.repository';
import { EvidenceRepository } from '@ba-helper/api/modules/evidence/infrastructure/evidence.repository';
import { TraceabilityRepository } from '@ba-helper/api/modules/traceability/infrastructure/traceability.repository';
import { EventLogRepository } from '@ba-helper/api/modules/event-log/infrastructure/event-log.repository';
import { EventLogService } from '@ba-helper/api/modules/event-log/application/event-log.service';
import { EventLogPortAdapter } from '@ba-helper/api/modules/event-log/infrastructure/event-log-port.adapter';
import { DomainPackRegistry } from '@ba-helper/api/modules/domain-pack/application/domain-pack.registry';
import { RetrievalModule } from '@ba-helper/api/modules/retrieval/retrieval.module';
import { HybridRetrievalService } from '@ba-helper/api/modules/retrieval/application/hybrid-retrieval.service';

/**
 * Worker-scoped ImpactAnalysis module.
 * Wires RunImpactAnalysisUseCase without loading API HTTP controllers.
 * LlmProviderPort is provided globally by AiModule.forRoot() in app.module.ts.
 *
 * Infrastructure repository classes are imported from apps/api paths.
 * NOTE: This is a known v0.1 constraint. Post-v0.1, these should be moved to
 * packages/application or a shared backend-infrastructure package.
 */
@Module({
  imports: [PrismaModule, RetrievalModule],
  providers: [
    ImpactAnalysisProcessor,
    DomainPackRegistry,
    {
      provide: EventLogRepository,
      useFactory: (prisma: PrismaService) => new EventLogRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: EventLogService,
      useFactory: (repo: EventLogRepository) => new EventLogService(repo),
      inject: [EventLogRepository],
    },
    {
      provide: ImpactAnalysisRepository,
      useFactory: (prisma: PrismaService) => new ImpactAnalysisRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: InsightRepository,
      useFactory: (prisma: PrismaService) => new InsightRepository(prisma),
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
      provide: TraceabilityRepository,
      useFactory: (prisma: PrismaService) => new TraceabilityRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ImpactEvidenceCollectionStep,
      useFactory: (
        artifactRepo: ArtifactRepository,
        evidenceRepo: EvidenceRepository,
        traceabilityRepo: TraceabilityRepository,
        retrievalService: HybridRetrievalService,
      ) => new ImpactEvidenceCollectionStep(artifactRepo, evidenceRepo, traceabilityRepo, retrievalService),
      inject: [ArtifactRepository, EvidenceRepository, TraceabilityRepository, HybridRetrievalService],
    },
    {
      provide: ImpactDiagnosticPropagationStep,
      useFactory: () => new ImpactDiagnosticPropagationStep(),
    },
    {
      provide: ImpactAiReasoningStep,
      useFactory: (llmProvider: LlmProviderPort) => new ImpactAiReasoningStep(llmProvider),
      inject: [LlmProviderPort],
    },
    {
      provide: RunImpactAnalysisUseCase,
      useFactory: (
        impactRepo: ImpactAnalysisRepository,
        insightRepo: InsightRepository,
        domainPackRegistry: DomainPackRegistry,
        evidenceStep: ImpactEvidenceCollectionStep,
        diagnosticStep: ImpactDiagnosticPropagationStep,
        aiReasoningStep: ImpactAiReasoningStep,
        eventLogService: EventLogService,
      ) =>
        new RunImpactAnalysisUseCase(
          impactRepo,
          insightRepo,
          domainPackRegistry,
          evidenceStep,
          diagnosticStep,
          aiReasoningStep,
          new EventLogPortAdapter(eventLogService),
        ),
      inject: [
        ImpactAnalysisRepository,
        InsightRepository,
        DomainPackRegistry,
        ImpactEvidenceCollectionStep,
        ImpactDiagnosticPropagationStep,
        ImpactAiReasoningStep,
        EventLogService,
      ],
    },
  ],
})
export class ImpactAnalysisWorkerModule {}
