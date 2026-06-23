import { Module } from '@nestjs/common';
import { DocumentController } from './api/document.controller';
import { ListDocumentsUseCase } from './application/list-documents.usecase';
import { GetApprovedReportUseCase } from './application/get-approved-report.usecase';
import { ExportApprovedReportUseCase } from './application/export-approved-report.usecase';
import { CreateReviewedReportSnapshotUseCase } from './application/create-reviewed-report-snapshot.usecase';
import { GetLatestReviewedReportSnapshotUseCase } from './application/get-latest-reviewed-report-snapshot.usecase';
import { GetFinalReviewedReportUseCase } from './application/get-final-reviewed-report.usecase';
import { EnqueueDocumentJobUseCase } from './application/enqueue-document-job.usecase';
import { RunDocumentJobUseCase } from './application/run-document-job.usecase';
import { DocumentRepository } from './infrastructure/document.repository';
import { MarkdownImpactReportBuilder } from './application/markdown-impact-report.builder';
import { MermaidImpactDiagramBuilder } from './application/mermaid-impact-diagram.builder';
import { ApprovedReportProjectionService } from './application/approved-report-projection.service';
import { MarkdownExportRenderer } from './application/markdown-export.renderer';
import { PdfExportRenderer } from './application/pdf-export.renderer';
import { PrismaModule } from '../prisma/prisma.module';
import { EventLogModule } from '../event-log/event-log.module';
import { EventLogService } from '../event-log/application/event-log.service';
import { ProjectModule } from '../project/project.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { InsightModule } from '../insight/insight.module';
import { GraphModule } from '../graph/graph.module';
import { ClarificationModule } from '../clarification/clarification.module';
import { ReviewNoteRepository } from '../impact-analysis/infrastructure/review-note.repository';
import { ReviewDecisionRepository } from '../impact-analysis/infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from '../impact-analysis/application/queries/get-impact-diff.usecase';

import { EvaluationContextAdapter } from './application/evaluation-context.adapter';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    EventLogModule,
    ProjectModule,
    TraceabilityModule,
    InsightModule,
    GraphModule,
    ClarificationModule,
    QueueModule,
  ],
  controllers: [DocumentController],
  providers: [
    DocumentRepository,
    ApprovedReportProjectionService,
    MarkdownExportRenderer,
    PdfExportRenderer,
    {
      provide: ListDocumentsUseCase,
      useFactory: (repo: DocumentRepository) => new ListDocumentsUseCase(repo),
      inject: [DocumentRepository],
    },
    {
      provide: GetApprovedReportUseCase,
      useFactory: (repo: DocumentRepository, projection: ApprovedReportProjectionService) =>
        new GetApprovedReportUseCase(repo, projection),
      inject: [DocumentRepository, ApprovedReportProjectionService],
    },
    {
      provide: ExportApprovedReportUseCase,
      useFactory: (
        repo: DocumentRepository,
        projection: ApprovedReportProjectionService,
        eventLog: EventLogService,
        markdownRenderer: MarkdownExportRenderer,
        pdfRenderer: PdfExportRenderer,
      ) =>
        new ExportApprovedReportUseCase(
          repo,
          projection,
          eventLog,
          markdownRenderer,
          pdfRenderer,
        ),
      inject: [
        DocumentRepository,
        ApprovedReportProjectionService,
        EventLogService,
        MarkdownExportRenderer,
        PdfExportRenderer,
      ],
    },
    EvaluationContextAdapter,
    MermaidImpactDiagramBuilder,
    MarkdownImpactReportBuilder,
    CreateReviewedReportSnapshotUseCase,
    GetLatestReviewedReportSnapshotUseCase,
    GetFinalReviewedReportUseCase,
    EnqueueDocumentJobUseCase,
    RunDocumentJobUseCase,
    ReviewNoteRepository,
    ReviewDecisionRepository,
    GetImpactDiffUseCase,
  ],
  exports: [
    DocumentRepository,
    MarkdownImpactReportBuilder,
    MarkdownExportRenderer,
    PdfExportRenderer,
    CreateReviewedReportSnapshotUseCase,
    GetLatestReviewedReportSnapshotUseCase,
    GetFinalReviewedReportUseCase,
    EnqueueDocumentJobUseCase,
    RunDocumentJobUseCase,
  ],
})
export class DocumentModule {}
