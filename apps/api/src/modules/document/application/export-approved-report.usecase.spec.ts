import { ExportApprovedReportUseCase } from './export-approved-report.usecase';
import { DocumentRepository } from '../infrastructure/document.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '../../../shared/app-error';

describe('ExportApprovedReportUseCase', () => {
  let useCase: ExportApprovedReportUseCase;
  let documentRepo: jest.Mocked<DocumentRepository>;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    documentRepo = {
      findApprovedReportByAnalysisId: jest.fn(),
    } as unknown as jest.Mocked<DocumentRepository>;

    prismaService = {
      domainEvent: {
        create: jest.fn(),
      },
      analysisReviewDecision: {
        findFirst: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    useCase = new ExportApprovedReportUseCase(documentRepo, prismaService);
  });

  it('should throw APPROVED_REPORT_NOT_FOUND if report is missing', async () => {
    documentRepo.findApprovedReportByAnalysisId.mockResolvedValue(null);

    await expect(useCase.execute('analysis-1')).rejects.toThrow(AppError);
    await expect(useCase.execute('analysis-1')).rejects.toMatchObject({
      code: 'APPROVED_REPORT_NOT_FOUND',
    });
  });

  it('should return markdown and safe filename, and record event', async () => {
    const mockReport = {
      id: 'doc-1',
      content: '# Test Content',
      impactAnalysis: {
        id: 'analysis-1',
        requirementRevision: {
          title: 'Special! @Title',
        },
        sourceTarget: {
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: 'sha1',
        },
        snapshot: {
          id: 'snapshot-1',
          repositoryId: 'repo-1',
          commitSha: 'sha1', // Not stale
        },
      },
    };

    documentRepo.findApprovedReportByAnalysisId.mockResolvedValue(mockReport as any);

    const result = await useCase.execute('analysis-1', 'test-actor');

    expect(result.markdown).toBe('# Test Content');
    expect(result.filename).toBe('special-title-impact-report.md');
    expect(result.isStale).toBe(false);

    expect(prismaService.domainEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'DOCUMENT_EXPORTED',
          payload: expect.objectContaining({
            eventType: 'DOCUMENT_EXPORTED',
            documentId: 'doc-1',
            impactAnalysisId: 'analysis-1',
            filename: 'special-title-impact-report.md',
            actorId: 'test-actor',
            isStale: false,
          }),
        }),
      })
    );
  });

  it('should not throw if domain event insertion fails', async () => {
    const mockReport = {
      id: 'doc-1',
      content: '# Test Content',
      impactAnalysis: {
        id: 'analysis-1',
        requirementRevision: {
          title: 'Title',
        },
        sourceTarget: {
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: 'sha1',
        },
        snapshot: {
          id: 'snapshot-1',
          repositoryId: 'repo-1',
          commitSha: 'sha1', // Not stale
        },
      },
    };

    documentRepo.findApprovedReportByAnalysisId.mockResolvedValue(mockReport as any);
    
    // Simulate DB error
    (prismaService.domainEvent.create as jest.Mock).mockRejectedValue(new Error('DB Error'));

    // Should not throw, should just warn and return the markdown
    const result = await useCase.execute('analysis-1');
    expect(result.markdown).toBe('# Test Content');
  });
});
