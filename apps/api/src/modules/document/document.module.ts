import { Module } from '@nestjs/common';
import { DocumentController } from './api/document.controller';
import { GetApprovedReportUseCase } from './application/get-approved-report.usecase';
import { ExportApprovedReportUseCase } from './application/export-approved-report.usecase';
import { ApprovedReportProjectionService } from './application/approved-report-projection.service';
import { MarkdownExportRenderer } from './application/markdown-export.renderer';
import { PdfExportRenderer } from './application/pdf-export.renderer';
import { EventLogModule } from '../event-log/event-log.module';
import { DocumentApplicationModule } from './document-application.module';
import { ProjectModule } from '../project/project.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { InsightModule } from '../insight/insight.module';
import { GraphModule } from '../graph/graph.module';
import { ClarificationModule } from '../clarification/clarification.module';
import { PrismaModule, DocumentRepository, EventLogService } from "@ba-helper/backend-runtime";

@Module({
  imports: [
    DocumentApplicationModule,
    EventLogModule,
    PrismaModule,
    ProjectModule,
    TraceabilityModule,
    InsightModule,
    GraphModule,
    ClarificationModule,
  ],
  controllers: [DocumentController],
  providers: [
    ApprovedReportProjectionService,
    MarkdownExportRenderer,
    PdfExportRenderer,
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
  ],
  exports: [
    DocumentApplicationModule,
    MarkdownExportRenderer,
    PdfExportRenderer,
  ],
})
export class DocumentModule {}
