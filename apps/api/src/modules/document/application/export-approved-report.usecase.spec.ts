import { RequestUser } from '@ba-helper/contracts';
import { EventLogService } from '../../event-log/application/event-log.service';
import { DocumentRepository } from '../infrastructure/document.repository';
import { AppError } from '../../../shared/app-error';
import { ApprovedReportProjectionService } from './approved-report-projection.service';
import { ExportApprovedReportUseCase } from './export-approved-report.usecase';
import { MarkdownExportRenderer } from './markdown-export.renderer';
import { PdfExportRenderer } from './pdf-export.renderer';

describe('ExportApprovedReportUseCase', () => {
  let useCase: ExportApprovedReportUseCase;
  let documentRepo: jest.Mocked<DocumentRepository>;
  let projectionService: jest.Mocked<ApprovedReportProjectionService>;
  let eventLog: jest.Mocked<EventLogService>;
  let markdownRenderer: jest.Mocked<MarkdownExportRenderer>;
  let pdfRenderer: jest.Mocked<PdfExportRenderer>;

  const actor: RequestUser = {
    id: 'user-1',
    email: 'viewer@ba-helper.local',
    role: 'VIEWER',
    name: 'Viewer',
  };

  beforeEach(() => {
    documentRepo = {
      findApprovedReportByAnalysisId: jest.fn(),
    } as unknown as jest.Mocked<DocumentRepository>;

    projectionService = {
      project: jest.fn(),
    } as unknown as jest.Mocked<ApprovedReportProjectionService>;

    eventLog = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<EventLogService>;

    markdownRenderer = {
      render: jest.fn(),
    } as unknown as jest.Mocked<MarkdownExportRenderer>;

    pdfRenderer = {
      render: jest.fn(),
    } as unknown as jest.Mocked<PdfExportRenderer>;

    useCase = new ExportApprovedReportUseCase(
      documentRepo,
      projectionService,
      eventLog,
      markdownRenderer,
      pdfRenderer,
    );
  });

  const mockReport = {
    id: 'doc-1',
    impactAnalysis: {
      id: 'analysis-1',
    },
    content: '# Approved report',
  };

  const mockProjection = {
    report: mockReport,
    isStale: false,
    metadata: {
      analysisId: 'analysis-1',
      title: 'Refund paid bookings',
      projectId: 'project-1',
      repositoryId: 'repo-1',
      targetRef: 'main',
      commitSha: 'abc1234',
      snapshotId: 'snapshot-1',
      analyzerVersion: '1.0.0',
      generatedDocumentId: 'doc-1',
      generatedAt: '2026-06-06T00:00:00.000Z',
      finalizedAt: '2026-06-06T00:00:00.000Z',
      staleStatusAtReadTime: false,
    },
  };

  it('throws APPROVED_REPORT_NOT_FOUND if report is missing', async () => {
    documentRepo.findApprovedReportByAnalysisId.mockResolvedValue(null);

    await expect(
      useCase.execute({ analysisId: 'analysis-1', actor, format: 'markdown' }),
    ).rejects.toMatchObject({
      code: 'APPROVED_REPORT_NOT_FOUND',
    });
  });

  it('blocks stale report export', async () => {
    documentRepo.findApprovedReportByAnalysisId.mockResolvedValue(mockReport as any);
    projectionService.project.mockResolvedValue({
      ...mockProjection,
      isStale: true,
      metadata: {
        ...mockProjection.metadata,
        staleStatusAtReadTime: true,
        staleReason: 'Source target advanced.',
      },
      staleReason: 'Source target advanced.',
    });

    await expect(
      useCase.execute({ analysisId: 'analysis-1', actor, format: 'markdown' }),
    ).rejects.toMatchObject({
      code: 'REPORT_EXPORT_BLOCKED_STALE',
    });
    expect(eventLog.recordEvent).not.toHaveBeenCalled();
  });

  it('renders markdown export and records audit event', async () => {
    documentRepo.findApprovedReportByAnalysisId.mockResolvedValue(mockReport as any);
    projectionService.project.mockResolvedValue(mockProjection as any);
    markdownRenderer.render.mockResolvedValue({
      contentType: 'text/markdown; charset=utf-8',
      filename: 'refund-paid-bookings-impact-report.md',
      buffer: Buffer.from('# Approved report'),
    });

    const result = await useCase.execute({
      analysisId: 'analysis-1',
      actor,
      format: 'markdown',
    });

    expect(result.filename).toBe('refund-paid-bookings-impact-report.md');
    expect(result.contentType).toContain('text/markdown');
    expect(markdownRenderer.render).toHaveBeenCalledWith({
      markdown: '# Approved report',
      metadata: mockProjection.metadata,
    });
    expect(eventLog.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DOCUMENT_EXPORTED',
        actorUserId: actor.id,
        payload: expect.objectContaining({
          format: 'markdown',
          generatedDocumentId: 'doc-1',
          projectId: 'project-1',
          repositoryId: 'repo-1',
          actorType: 'VIEWER',
        }),
      }),
    );
  });

  it('renders pdf export and records audit after successful render only', async () => {
    documentRepo.findApprovedReportByAnalysisId.mockResolvedValue(mockReport as any);
    projectionService.project.mockResolvedValue(mockProjection as any);
    pdfRenderer.render.mockResolvedValue({
      contentType: 'application/pdf',
      filename: 'refund-paid-bookings-impact-report.pdf',
      buffer: Buffer.from('pdf'),
    });

    const result = await useCase.execute({
      analysisId: 'analysis-1',
      actor,
      format: 'pdf',
    });

    expect(result.contentType).toBe('application/pdf');
    expect(pdfRenderer.render).toHaveBeenCalled();
    expect(eventLog.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          format: 'pdf',
        }),
      }),
    );
  });

  it('does not emit DOCUMENT_EXPORTED when renderer fails', async () => {
    documentRepo.findApprovedReportByAnalysisId.mockResolvedValue(mockReport as any);
    projectionService.project.mockResolvedValue(mockProjection as any);
    pdfRenderer.render.mockRejectedValue(
      new AppError('PDF_RENDER_FAILED', 'render failed'),
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-1', actor, format: 'pdf' }),
    ).rejects.toMatchObject({
      code: 'PDF_RENDER_FAILED',
    });
    expect(eventLog.recordEvent).not.toHaveBeenCalled();
  });
});
