import { GetApprovedReportUseCase } from './get-approved-report.usecase';
import { DocumentRepository } from '../infrastructure/document.repository';
import { AppError } from '../../../shared/app-error';

describe('GetApprovedReportUseCase', () => {
  let useCase: GetApprovedReportUseCase;
  let repository: jest.Mocked<DocumentRepository>;

  beforeEach(() => {
    repository = {
      findApprovedReportByAnalysisId: jest.fn(),
    } as unknown as jest.Mocked<DocumentRepository>;

    useCase = new GetApprovedReportUseCase(repository);
  });

  const validParams = 'analysis-1';

  const mockValidState = (overrides = {}) => {
    repository.findApprovedReportByAnalysisId.mockResolvedValue({
      id: 'doc-1',
      impactAnalysisId: 'analysis-1',
      type: 'IMPACT_REPORT',
      status: 'APPROVED',
      content: '# Report',
      impactAnalysis: {
        snapshot: { commitSha: 'abc1234', analyzerVersion: '0.1' },
        sourceTarget: {
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: 'abc1234',
        },
        requirementRevision: { id: 'rev-1', title: 'Test Title' },
      },
      ...overrides,
    } as any);
  };

  it('UC08-A (Fresh): returns report with isStale=false', async () => {
    mockValidState();

    const result = await useCase.execute(validParams);

    expect(result.report.id).toBe('doc-1');
    expect(result.isStale).toBe(false);
    expect(result.staleReason).toBeUndefined();
  });

  it('UC08-A (Stale): returns report with isStale=true when target advanced', async () => {
    mockValidState({
      impactAnalysis: {
        snapshot: { commitSha: 'abc1234', analyzerVersion: '0.1' },
        sourceTarget: {
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: 'newer-commit',
        },
        requirementRevision: { id: 'rev-1', title: 'Test Title' },
      },
    });

    const result = await useCase.execute(validParams);

    expect(result.report.id).toBe('doc-1');
    expect(result.isStale).toBe(true);
    expect(result.staleReason).toBe('Source target has advanced to a newer commit since analysis.');
  });

  it('Pinned commit target: isStale=false even if latestObservedCommitSha differs', async () => {
    mockValidState({
      impactAnalysis: {
        snapshot: { commitSha: 'abc1234', analyzerVersion: '0.1' },
        sourceTarget: {
          resolvedRefType: 'COMMIT',
          latestObservedCommitSha: 'newer-commit', // Should be ignored for pinned commit
        },
        requirementRevision: { id: 'rev-1', title: 'Test Title' },
      },
    });

    const result = await useCase.execute(validParams);

    expect(result.report.id).toBe('doc-1');
    expect(result.isStale).toBe(false);
  });

  it('Missing report: throws APPROVED_REPORT_NOT_FOUND', async () => {
    repository.findApprovedReportByAnalysisId.mockResolvedValue(null);

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'APPROVED_REPORT_NOT_FOUND',
      message: 'Approved impact report not found.',
    });
  });

  it('No latestObservedCommitSha: isStale=false', async () => {
    mockValidState({
      impactAnalysis: {
        snapshot: { commitSha: 'abc1234', analyzerVersion: '0.1' },
        sourceTarget: {
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: null,
        },
        requirementRevision: { id: 'rev-1', title: 'Test Title' },
      },
    });

    const result = await useCase.execute(validParams);

    expect(result.isStale).toBe(false);
  });
});
