import { RequestUser } from '@ba-helper/contracts';
import { AppError } from '../../../../shared/app-error';
import { EventLogService } from '../../../event-log/application/event-log.service';
import { MarkdownExportRenderer } from '../../../document/application/markdown-export.renderer';
import { PdfExportRenderer } from '../../../document/application/pdf-export.renderer';
import { GetApprovedMultiRepoReportUseCase } from './get-approved-multi-repo-report.usecase';
import { ExportApprovedMultiRepoReportUseCase } from './export-approved-multi-repo-report.usecase';

describe('ExportApprovedMultiRepoReportUseCase', () => {
  let useCase: ExportApprovedMultiRepoReportUseCase;
  let getApprovedReport: jest.Mocked<GetApprovedMultiRepoReportUseCase>;
  let eventLog: jest.Mocked<EventLogService>;
  let markdownRenderer: jest.Mocked<MarkdownExportRenderer>;
  let pdfRenderer: jest.Mocked<PdfExportRenderer>;

  const actor: RequestUser = {
    id: 'user-1',
    email: 'viewer@ba-helper.local',
    role: 'VIEWER',
    name: 'Viewer',
  };

  const approvedReport = {
    id: 'merged-report-1',
    runId: 'run-1',
    projectId: 'project-1',
    requirementRevisionId: 'revision-1',
    requirementTitle: 'Refund paid bookings',
    markdown: '# Merged approved report',
    approvedAt: '2026-06-09T08:00:00.000Z',
    isStale: false,
    staleReason: undefined,
    provenance: {
      childAnalyses: [
        {
          analysisId: 'analysis-1',
          latestReviewDecisionId: 'decision-1',
          snapshotId: 'snapshot-1',
          commitSha: 'abc1234',
        },
        {
          analysisId: 'analysis-2',
          latestReviewDecisionId: 'decision-2',
          snapshotId: 'snapshot-2',
          commitSha: 'def5678',
        },
      ],
    },
  };

  beforeEach(() => {
    getApprovedReport = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetApprovedMultiRepoReportUseCase>;
    eventLog = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<EventLogService>;
    markdownRenderer = {
      render: jest.fn(),
    } as unknown as jest.Mocked<MarkdownExportRenderer>;
    pdfRenderer = {
      render: jest.fn(),
    } as unknown as jest.Mocked<PdfExportRenderer>;

    useCase = new ExportApprovedMultiRepoReportUseCase(
      getApprovedReport,
      eventLog,
      markdownRenderer,
      pdfRenderer,
    );
  });

  it('blocks stale approved merged report export', async () => {
    getApprovedReport.execute.mockResolvedValue({
      ...approvedReport,
      isStale: true,
      staleReason: 'Child review decisions changed.',
    });

    await expect(
      useCase.execute({ runId: 'run-1', actor, format: 'markdown' }),
    ).rejects.toMatchObject({
      code: 'MERGED_REPORT_EXPORT_BLOCKED_STALE',
    });
    expect(eventLog.recordEvent).not.toHaveBeenCalled();
  });

  it('renders markdown export and records audit metadata', async () => {
    getApprovedReport.execute.mockResolvedValue(approvedReport);
    markdownRenderer.render.mockResolvedValue({
      contentType: 'text/markdown; charset=utf-8',
      filename: 'refund-paid-bookings-merged-report-impact-report.md',
      buffer: Buffer.from('# Merged approved report'),
    });

    const result = await useCase.execute({
      runId: 'run-1',
      actor,
      format: 'markdown',
    });

    expect(result.filename).toContain('.md');
    expect(markdownRenderer.render).toHaveBeenCalledWith({
      markdown: approvedReport.markdown,
      metadata: expect.objectContaining({
        reportScope: 'MULTI_REPO_RUN',
        runId: approvedReport.runId,
        generatedDocumentId: approvedReport.id,
        childAnalysisCount: 2,
      }),
    });
    expect(eventLog.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DOCUMENT_EXPORTED',
        actorUserId: actor.id,
        payload: expect.objectContaining({
          runId: approvedReport.runId,
          approvedMergedReportId: approvedReport.id,
          format: 'markdown',
        }),
      }),
    );
  });

  it('does not record export event when pdf render fails', async () => {
    getApprovedReport.execute.mockResolvedValue(approvedReport);
    pdfRenderer.render.mockRejectedValue(
      new AppError('PDF_RENDER_FAILED', 'render failed'),
    );

    await expect(
      useCase.execute({ runId: approvedReport.runId, actor, format: 'pdf' }),
    ).rejects.toMatchObject({
      code: 'PDF_RENDER_FAILED',
    });
    expect(eventLog.recordEvent).not.toHaveBeenCalled();
  });
});
