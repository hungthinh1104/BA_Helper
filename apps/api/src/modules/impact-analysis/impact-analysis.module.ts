import { Module } from '@nestjs/common';
import { CreateImpactAnalysisUseCase } from './application/lifecycle/create-impact-analysis.usecase';
import { GetImpactAnalysisUseCase } from './application/lifecycle/get-impact-analysis.usecase';
import { FinalizeImpactAnalysisUseCase } from './application/lifecycle/finalize-impact-analysis.usecase';
import { ListImpactAnalysesUseCase } from './application/lifecycle/list-impact-analyses.usecase';
import {
  RunImpactAnalysisUseCase,
  ImpactEvidenceCollectionStep,
  ImpactDiagnosticPropagationStep,
  ImpactAiReasoningStep,
} from '@ba-helper/application';
import { GetImpactGraphUseCase } from './application/queries/get-impact-graph.usecase';
import { GetQaCoverageUseCase } from './application/qa/get-qa-coverage.usecase';
import { QaCoverageDeriver } from './application/qa/qa-coverage.deriver';
import { GetReviewQueueUseCase } from './application/review/get-review-queue.usecase';
import { SaveReviewNoteUseCase } from './application/review/save-review-note.usecase';
import { GetReviewNotesUseCase } from './application/review/get-review-notes.usecase';
import { GetImpactDiffUseCase } from './application/queries/get-impact-diff.usecase';
import { CreateAnalysisReviewDecisionUseCase } from './application/review/create-analysis-review-decision.usecase';
import { ListReviewDecisionsUseCase } from './application/review/list-review-decisions.usecase';
import { GetLatestReviewDecisionUseCase } from './application/review/get-latest-review-decision.usecase';
import { CreateReviewClarificationRequestUseCase } from './application/review/create-review-clarification.usecase';
import { ListReviewClarificationsUseCase } from './application/review/list-review-clarifications.usecase';
import { AnswerReviewClarificationUseCase } from './application/review/answer-review-clarification.usecase';
import { CreateDerivedAnalysisFromClarificationUseCase } from './application/lifecycle/create-derived-analysis-from-clarification.usecase';
import { GetImpactAnalysisLineageUseCase } from './application/queries/get-impact-analysis-lineage.usecase';
import { GetReviewCoverageUseCase } from './application/review/get-review-coverage.usecase';
import { CreateMultiRepoImpactAnalysesUseCase } from './application/multi-repo/create-multi-repo-impact-analyses.usecase';
import { GetMultiRepoAnalysisRunUseCase } from './application/multi-repo/get-multi-repo-analysis-run.usecase';
import { BuildMultiRepoImpactMatrixReadModel } from './application/multi-repo/build-multi-repo-impact-matrix.read-model';
import { GetMatrixRowDetailUseCase } from './application/queries/get-matrix-row-detail.usecase';
import { GetMergedMultiRepoReportDraftUseCase } from './application/multi-repo/get-merged-multi-repo-report-draft.usecase';
import { FinalizeMultiRepoReportUseCase } from './application/multi-repo/finalize-multi-repo-report.usecase';
import { GetApprovedMultiRepoReportUseCase } from './application/multi-repo/get-approved-multi-repo-report.usecase';
import { ExportApprovedMultiRepoReportUseCase } from './application/multi-repo/export-approved-multi-repo-report.usecase';
import { ListMultiRepoAnalysisRunsUseCase } from './application/multi-repo/list-multi-repo-analysis-runs.usecase';
import { CreateMergedMultiRepoReportReviewDecisionUseCase } from './application/multi-repo/create-merged-multi-repo-report-review-decision.usecase';
import { ListMergedMultiRepoReportReviewDecisionsUseCase } from './application/multi-repo/list-merged-multi-repo-report-review-decisions.usecase';
import { GetLatestMergedMultiRepoReportReviewDecisionUseCase } from './application/multi-repo/get-latest-merged-multi-repo-report-review-decision.usecase';
import { MergedMultiRepoReportDraftBuilder } from './application/multi-repo/merged-multi-repo-report-draft.builder';
import { ReviewNoteController } from './api/review-note.controller';
import { ReviewClarificationController } from './api/review-clarification.controller';
import { ImpactAnalysisLifecycleController } from './api/impact-analysis-lifecycle.controller';
import { ImpactAnalysisReadModelController } from './api/impact-analysis-read-model.controller';
import { ImpactAnalysisReviewController } from './api/impact-analysis-review.controller';
import { MultiRepoAnalysisController } from './api/multi-repo-analysis.controller';
import { ReviewNoteRepository } from './infrastructure/review-note.repository';
import { ReviewDecisionRepository } from './infrastructure/review-decision.repository';
import { ReviewClarificationRepository } from './infrastructure/review-clarification.repository';
import { ImpactGraphReadModelBuilder } from './application/queries/impact-graph-read-model.builder';
import { ImpactAnalysisRepository } from './infrastructure/impact-analysis.repository';
import { MultiRepoAnalysisRunRepository } from './infrastructure/multi-repo-analysis-run.repository';
import { MultiRepoMergedReportRepository } from './infrastructure/multi-repo-merged-report.repository';
import { MergedMultiRepoReportReviewDecisionRepository } from './infrastructure/merged-multi-repo-report-review-decision.repository';
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
import { RetrievalModule } from '@ba-helper/backend-runtime';
import { HybridRetrievalService } from '@ba-helper/backend-runtime';
import { ProjectRepository } from '../project/infrastructure/project.repository';
import { GraphModule } from '../graph/graph.module';
import { ClarificationModule } from '../clarification/clarification.module';
import { CreateRequirementRevisionUseCase } from '../requirement/application/create-revision.usecase';
import { ProjectModule } from '../project/project.module';
import { RepositoryModule } from '../repository/repository.module';
import { GetAnalysisDriftFreshnessUseCase } from './application/queries/get-analysis-drift-freshness.usecase';
import { GetAnalysisWorkspaceUseCase } from './application/queries/get-analysis-workspace.usecase';
import { DomainPackModule } from '@ba-helper/backend-runtime';
import { DomainPackRegistry } from '@ba-helper/backend-runtime';
import { EventLogPortAdapter } from '../event-log/infrastructure/event-log-port.adapter';

@Module({
  imports: [PrismaModule, EventLogModule, DocumentModule, QueueModule, AiModule, RetrievalModule, GraphModule, ClarificationModule, ProjectModule, RepositoryModule, DomainPackModule],
  controllers: [
    ImpactAnalysisLifecycleController,
    ImpactAnalysisReadModelController,
    ImpactAnalysisReviewController,
    MultiRepoAnalysisController,
    ReviewNoteController,
    ReviewClarificationController,
  ],
  providers: [
    ImpactAnalysisRepository,
    MultiRepoAnalysisRunRepository,
    MultiRepoMergedReportRepository,
    MergedMultiRepoReportReviewDecisionRepository,
    RequirementRepository,
    CreateRequirementRevisionUseCase,
    ArtifactRepository,
    EvidenceRepository,
    InsightRepository,
    TraceabilityRepository,
    CreateImpactAnalysisUseCase,
    CreateMultiRepoImpactAnalysesUseCase,
    GetImpactAnalysisUseCase,
    GetMultiRepoAnalysisRunUseCase,
    BuildMultiRepoImpactMatrixReadModel,
    GetMatrixRowDetailUseCase,
    GetMergedMultiRepoReportDraftUseCase,
    FinalizeMultiRepoReportUseCase,
    GetApprovedMultiRepoReportUseCase,
    ExportApprovedMultiRepoReportUseCase,
    ListMultiRepoAnalysisRunsUseCase,
    CreateMergedMultiRepoReportReviewDecisionUseCase,
    ListMergedMultiRepoReportReviewDecisionsUseCase,
    GetLatestMergedMultiRepoReportReviewDecisionUseCase,
    MergedMultiRepoReportDraftBuilder,
    FinalizeImpactAnalysisUseCase,
    {
      provide: ImpactEvidenceCollectionStep,
      useFactory: (artifactRepo: ArtifactRepository, evidenceRepo: EvidenceRepository, traceabilityRepo: TraceabilityRepository, retrievalService: HybridRetrievalService) =>
        new ImpactEvidenceCollectionStep(artifactRepo, evidenceRepo, traceabilityRepo, retrievalService),
      inject: [ArtifactRepository, EvidenceRepository, TraceabilityRepository, HybridRetrievalService],
    },
    {
      provide: ImpactDiagnosticPropagationStep,
      useFactory: () => new ImpactDiagnosticPropagationStep(),
    },
    {
      provide: ImpactAiReasoningStep,
      useFactory: (llmProvider: LlmProvider) => new ImpactAiReasoningStep(llmProvider),
      inject: [LlmProvider],
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
    ImpactGraphReadModelBuilder,
    GetImpactGraphUseCase,
    QaCoverageDeriver,
    GetQaCoverageUseCase,
    GetReviewQueueUseCase,
    ReviewNoteRepository,
    ReviewDecisionRepository,
    ReviewClarificationRepository,
    SaveReviewNoteUseCase,
    GetReviewNotesUseCase,
    GetImpactDiffUseCase,
    CreateAnalysisReviewDecisionUseCase,
    ListReviewDecisionsUseCase,
    GetLatestReviewDecisionUseCase,
    CreateReviewClarificationRequestUseCase,
    ListReviewClarificationsUseCase,
    AnswerReviewClarificationUseCase,
    CreateDerivedAnalysisFromClarificationUseCase,
    GetImpactAnalysisLineageUseCase,
    GetReviewCoverageUseCase,
    GetAnalysisDriftFreshnessUseCase,
    GetAnalysisWorkspaceUseCase,
    {
      provide: ProjectRepository,
      useFactory: (prisma: PrismaService) => new ProjectRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ListImpactAnalysesUseCase,
      useFactory: (
        impactAnalysisRepo: ImpactAnalysisRepository,
        projectRepo: ProjectRepository,
      ) => new ListImpactAnalysesUseCase(impactAnalysisRepo, projectRepo),
      inject: [ImpactAnalysisRepository, ProjectRepository],
    },
  ],
  exports: [ImpactAnalysisRepository, RunImpactAnalysisUseCase],
})
export class ImpactAnalysisModule {}
