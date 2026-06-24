import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventLogModule } from '../event-log/event-log.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { InsightModule } from '../insight/insight.module';
import { GraphModule } from '../graph/graph.module';
import { ClarificationModule } from '../clarification/clarification.module';
import { QueueModule } from '../queue/queue.module';

import { CreateReviewedReportSnapshotUseCase } from './application/commands/create-reviewed-report-snapshot.usecase';
import { EnqueueDocumentJobUseCase } from './application/commands/enqueue-document-job.usecase';
import { RunDocumentJobUseCase } from './application/jobs/run-document-job.usecase';
import { GetFinalReviewedReportUseCase } from './application/queries/get-final-reviewed-report.usecase';
import { GetLatestReviewedReportSnapshotUseCase } from './application/queries/get-latest-reviewed-report-snapshot.usecase';
import { ListDocumentsUseCase } from './application/queries/list-documents.usecase';

import { MarkdownImpactReportBuilder } from './application/render/markdown-impact-report.builder';
import { ReviewedSnapshotReportContextAdapter } from './application/render/reviewed-snapshot-report-context.adapter';
import { DocumentRepository } from './infrastructure/document.repository';
import { MermaidImpactDiagramBuilder } from './application/mermaid-impact-diagram.builder';
import { EvaluationContextAdapter } from './application/evaluation-context.adapter';

import { ReviewNoteRepository } from '../impact-analysis/infrastructure/review-note.repository';
import { ReviewDecisionRepository } from '../impact-analysis/infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from '../impact-analysis/application/queries/get-impact-diff.usecase';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    EventLogModule,
    TraceabilityModule,
    InsightModule,
    GraphModule,
    ClarificationModule,
  ],
  providers: [
    CreateReviewedReportSnapshotUseCase,
    EnqueueDocumentJobUseCase,
    RunDocumentJobUseCase,
    GetFinalReviewedReportUseCase,
    GetLatestReviewedReportSnapshotUseCase,
    {
      provide: ListDocumentsUseCase,
      useFactory: (repo: DocumentRepository) => new ListDocumentsUseCase(repo),
      inject: [DocumentRepository],
    },
    MarkdownImpactReportBuilder,
    ReviewedSnapshotReportContextAdapter,
    DocumentRepository,
    MermaidImpactDiagramBuilder,
    EvaluationContextAdapter,
    ReviewNoteRepository,
    ReviewDecisionRepository,
    GetImpactDiffUseCase,
  ],
  exports: [
    CreateReviewedReportSnapshotUseCase,
    EnqueueDocumentJobUseCase,
    RunDocumentJobUseCase,
    GetFinalReviewedReportUseCase,
    GetLatestReviewedReportSnapshotUseCase,
    ListDocumentsUseCase,
    DocumentRepository,
    EvaluationContextAdapter,
  ],
})
export class DocumentApplicationModule {}
