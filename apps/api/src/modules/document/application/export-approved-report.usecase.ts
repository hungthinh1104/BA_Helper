import { Injectable } from '@nestjs/common';
import { RequestUser } from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';
import { ApprovedReportProjectionService } from './approved-report-projection.service';
import { ExportFormat, RenderedExport } from './document-export.renderer';
import { MarkdownExportRenderer } from './markdown-export.renderer';
import { PdfExportRenderer } from './pdf-export.renderer';
import { DocumentRepository, EventLogService } from "@ba-helper/backend-runtime";

@Injectable()
export class ExportApprovedReportUseCase {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly projectionService: ApprovedReportProjectionService,
    private readonly eventLog: EventLogService,
    private readonly markdownRenderer: MarkdownExportRenderer,
    private readonly pdfRenderer: PdfExportRenderer,
  ) {}

  async execute(params: {
    analysisId: string;
    actor: RequestUser;
    format: ExportFormat;
  }): Promise<RenderedExport> {
    const report = await this.documentRepository.findApprovedReportByAnalysisId(params.analysisId);

    if (!report) {
      throw new AppError('APPROVED_REPORT_NOT_FOUND', 'Approved impact report not found.');
    }

    const projection = await this.projectionService.project(report);

    if (projection.isStale) {
      throw new AppError(
        'REPORT_EXPORT_BLOCKED_STALE',
        projection.staleReason ?? 'Approved report is stale and cannot be exported.',
      );
    }

    const renderer = params.format === 'pdf' ? this.pdfRenderer : this.markdownRenderer;
    const rendered = await renderer.render({
      markdown: projection.report.content,
      metadata: projection.metadata,
    });

    await this.eventLog.recordEvent({
      eventType: 'DOCUMENT_EXPORTED',
      idempotencyKey: `document:${projection.metadata.generatedDocumentId}:export:${params.format}:${Date.now()}`,
      actorUserId: params.actor.id,
      payload: {
        format: params.format,
        analysisId: projection.metadata.analysisId,
        generatedDocumentId: projection.metadata.generatedDocumentId,
        projectId: projection.metadata.projectId,
        repositoryId: projection.metadata.repositoryId,
        snapshotId: projection.metadata.snapshotId,
        commitSha: projection.metadata.commitSha,
        actorType: params.actor.role,
        exportedAt: new Date().toISOString(),
        filename: rendered.filename,
      },
    });

    return rendered;
  }
}
