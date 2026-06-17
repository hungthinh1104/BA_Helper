import { DocumentRepository } from '../infrastructure/document.repository';
import { GetApprovedReportUseCase } from './get-approved-report.usecase';
import { ApprovedReportProjectionService } from './approved-report-projection.service';

describe('GetApprovedReportUseCase', () => {
  let useCase: GetApprovedReportUseCase;
  let repository: jest.Mocked<DocumentRepository>;
  let projectionService: jest.Mocked<ApprovedReportProjectionService>;

  beforeEach(() => {
    repository = {
      findApprovedReportByAnalysisId: jest.fn(),
    } as unknown as jest.Mocked<DocumentRepository>;

    projectionService = {
      project: jest.fn(),
    } as unknown as jest.Mocked<ApprovedReportProjectionService>;

    useCase = new GetApprovedReportUseCase(repository, projectionService);
  });

  it('returns projected report view', async () => {
    const report = { id: 'doc-1' };
    repository.findApprovedReportByAnalysisId.mockResolvedValue(report as any);
    projectionService.project.mockResolvedValue({
      report,
      isStale: false,
      metadata: {
        analysisId: 'analysis-1',
        title: 'Refund report',
        projectId: 'project-1',
        repositoryId: 'repo-1',
        targetRef: 'main',
        commitSha: 'abc1234',
        snapshotId: 'snapshot-1',
        analyzerVersion: '1.0.0',
        generatedDocumentId: 'doc-1',
        generatedAt: '2026-06-06T00:00:00.000Z',
        approvedDocumentCreatedAt: '2026-06-01T00:00:00.000Z',
        approvedDocumentUpdatedAt: '2026-06-06T00:00:00.000Z',
        staleStatusAtReadTime: false,
      },
    } as any);

    const result = await useCase.execute('analysis-1');

    expect(result.report).toBe(report);
    expect(result.isStale).toBe(false);
    expect(result.metadata.generatedDocumentId).toBe('doc-1');
  });

  it('throws APPROVED_REPORT_NOT_FOUND when missing', async () => {
    repository.findApprovedReportByAnalysisId.mockResolvedValue(null);

    await expect(useCase.execute('analysis-1')).rejects.toMatchObject({
      code: 'APPROVED_REPORT_NOT_FOUND',
    });
  });
});
