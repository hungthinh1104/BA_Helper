import { Module } from '@nestjs/common';
import { ImpactAnalysisController } from './api/impact-analysis.controller';
import { CreateImpactAnalysisUseCase } from './application/create-impact-analysis.usecase';
import { GetImpactAnalysisUseCase } from './application/get-impact-analysis.usecase';
import { FinalizeImpactAnalysisUseCase } from './application/finalize-impact-analysis.usecase';
import { ListImpactAnalysesUseCase } from './application/list-impact-analyses.usecase';
import { RunImpactAnalysisUseCase } from './application/run-impact-analysis.usecase';
import { GetImpactGraphUseCase } from './application/get-impact-graph.usecase';
import { GetQaCoverageUseCase } from './application/get-qa-coverage.usecase';
import { QaCoverageDeriver } from './application/qa-coverage.deriver';
import { GetReviewQueueUseCase } from './application/get-review-queue.usecase';
import { SaveReviewNoteUseCase } from './application/save-review-note.usecase';
import { GetReviewNotesUseCase } from './application/get-review-notes.usecase';
import { GetImpactDiffUseCase } from './application/get-impact-diff.usecase';
import { CreateAnalysisReviewDecisionUseCase } from './application/create-analysis-review-decision.usecase';
import { ListReviewDecisionsUseCase } from './application/list-review-decisions.usecase';
import { GetLatestReviewDecisionUseCase } from './application/get-latest-review-decision.usecase';
import { CreateReviewClarificationRequestUseCase } from './application/create-review-clarification.usecase';
import { ListReviewClarificationsUseCase } from './application/list-review-clarifications.usecase';
import { AnswerReviewClarificationUseCase } from './application/answer-review-clarification.usecase';
import { CreateDerivedAnalysisFromClarificationUseCase } from './application/create-derived-analysis-from-clarification.usecase';
import { GetImpactAnalysisLineageUseCase } from './application/get-impact-analysis-lineage.usecase';
import { CreateMultiRepoImpactAnalysesUseCase } from './application/create-multi-repo-impact-analyses.usecase';
import { GetMultiRepoAnalysisRunUseCase } from './application/get-multi-repo-analysis-run.usecase';
import { GetMultiRepoImpactMatrixUseCase } from './application/get-multi-repo-impact-matrix.usecase';
import { GetMergedMultiRepoReportDraftUseCase } from './application/get-merged-multi-repo-report-draft.usecase';
import { FinalizeMultiRepoReportUseCase } from './application/finalize-multi-repo-report.usecase';
import { GetApprovedMultiRepoReportUseCase } from './application/get-approved-multi-repo-report.usecase';
import { ExportApprovedMultiRepoReportUseCase } from './application/export-approved-multi-repo-report.usecase';
import { ListMultiRepoAnalysisRunsUseCase } from './application/list-multi-repo-analysis-runs.usecase';
import { CreateMergedMultiRepoReportReviewDecisionUseCase } from './application/create-merged-multi-repo-report-review-decision.usecase';
import { ListMergedMultiRepoReportReviewDecisionsUseCase } from './application/list-merged-multi-repo-report-review-decisions.usecase';
import { GetLatestMergedMultiRepoReportReviewDecisionUseCase } from './application/get-latest-merged-multi-repo-report-review-decision.usecase';
import { MergedMultiRepoReportDraftBuilder } from './application/merged-multi-repo-report-draft.builder';
import { ReviewNoteController } from './api/review-note.controller';
import { ReviewClarificationController } from './api/review-clarification.controller';
import { ReviewNoteRepository } from './infrastructure/review-note.repository';
import { ReviewDecisionRepository } from './infrastructure/review-decision.repository';
import { ReviewClarificationRepository } from './infrastructure/review-clarification.repository';
import { ImpactGraphReadModelBuilder } from './application/impact-graph-read-model.builder';
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
import { RetrievalModule } from '../retrieval/retrieval.module';
import { HybridRetrievalService } from '../retrieval/application/hybrid-retrieval.service';
import { ProjectRepository } from '../project/infrastructure/project.repository';
import { GraphModule } from '../graph/graph.module';
import { ClarificationModule } from '../clarification/clarification.module';
import { CreateRequirementRevisionUseCase } from '../requirement/application/create-revision.usecase';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [PrismaModule, EventLogModule, DocumentModule, QueueModule, AiModule, RetrievalModule, GraphModule, ClarificationModule, ProjectModule],
  controllers: [ImpactAnalysisController, ReviewNoteController, ReviewClarificationController],
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
    GetMultiRepoImpactMatrixUseCase,
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
    RunImpactAnalysisUseCase,
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
  exports: [ImpactAnalysisRepository],
})
export class ImpactAnalysisModule {}
