import { Injectable } from '@nestjs/common';
import { RequestUser } from '@ba-helper/contracts';
import { AppError } from '../../../shared/app-error';
import { EventLogService } from '../../event-log/application/event-log.service';
import { MarkdownExportRenderer } from '../../document/application/markdown-export.renderer';
import { PdfExportRenderer } from '../../document/application/pdf-export.renderer';
import {
  ExportFormat,
  RenderedExport,
} from '../../document/application/document-export.renderer';
import { GetApprovedMultiRepoReportUseCase } from './get-approved-multi-repo-report.usecase';

@Injectable()
export class ExportApprovedMultiRepoReportUseCase {
  constructor(
    private readonly getApprovedReport: GetApprovedMultiRepoReportUseCase,
    private readonly eventLog: EventLogService,
    private readonly markdownRenderer: MarkdownExportRenderer,
    private readonly pdfRenderer: PdfExportRenderer,
  ) {}

  async execute(params: {
    runId: string;
    actor: RequestUser;
    format: ExportFormat;
  }): Promise<RenderedExport> {
    const report = await this.getApprovedReport.execute(params.runId);

    if (report.isStale) {
      throw new AppError(
        'MERGED_REPORT_EXPORT_BLOCKED_STALE',
        report.staleReason ??
          'Approved merged report is stale and cannot be exported.',
      );
    }

    const renderer =
      params.format === 'pdf' ? this.pdfRenderer : this.markdownRenderer;

    const rendered = await renderer.render({
      markdown: report.markdown,
      metadata: {
        reportScope: 'MULTI_REPO_RUN',
        analysisId: report.runId,
        runId: report.runId,
        title: `${report.requirementTitle} merged report`,
        projectId: report.projectId,
        requirementRevisionId: report.requirementRevisionId,
        generatedDocumentId: report.id,
        generatedAt: report.approvedAt,
        staleStatusAtReadTime: report.isStale,
        staleReason: report.staleReason,
        childAnalysisCount: report.provenance.childAnalyses.length,
      },
    });

    await this.eventLog.recordEvent({
      eventType: 'DOCUMENT_EXPORTED',
      idempotencyKey: `merged-report:${report.id}:export:${params.format}:${Date.now()}`,
      actorUserId: params.actor.id,
      payload: {
        format: params.format,
        runId: report.runId,
        projectId: report.projectId,
        requirementRevisionId: report.requirementRevisionId,
        approvedMergedReportId: report.id,
        actorType: params.actor.role,
        exportedAt: new Date().toISOString(),
        filename: rendered.filename,
        staleStatusAtExportTime: report.isStale,
      },
    });

    return rendered;
  }
}
