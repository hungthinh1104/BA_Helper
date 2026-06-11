import { Module } from '@nestjs/common';
import { DocumentController } from './api/document.controller';
import { ListDocumentsUseCase } from './application/list-documents.usecase';
import { GetApprovedReportUseCase } from './application/get-approved-report.usecase';
import { ExportApprovedReportUseCase } from './application/export-approved-report.usecase';
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

@Module({
  imports: [PrismaModule, EventLogModule, ProjectModule],
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
    MermaidImpactDiagramBuilder,
    MarkdownImpactReportBuilder,
  ],
  exports: [DocumentRepository, MarkdownImpactReportBuilder],
})
export class DocumentModule {}
