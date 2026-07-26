import { GetReviewCompletionUseCase } from './get-review-completion.usecase';
import { PrismaService, TraceabilityRepository, InsightRepository } from "@ba-helper/backend-runtime";

describe('GetReviewCompletionUseCase', () => {
  it('includes critical approval gate blockers in backend-authored completion state', async () => {
    const prisma = {
      impactAnalysis: {
        findUnique: jest.fn().mockResolvedValue({ id: 'analysis-1' }),
      },
      reviewedReportSnapshot: {
        findFirst: jest.fn().mockResolvedValue({ id: 'snapshot-1' }),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const traceabilityRepo = {
      listByAnalysis: jest.fn().mockResolvedValue([
        {
          id: 'link-1',
          linkType: 'AFFECTED',
          linkBasis: 'INFERRED',
          reviewStatus: 'NEEDS_REVIEW',
          reviewDecision: null,
          evidenceLinks: [],
        },
      ]),
    } as unknown as jest.Mocked<TraceabilityRepository>;

    const insightRepo = {
      listByAnalysis: jest.fn().mockResolvedValue([
        {
          id: 'insight-1',
          insightType: 'CLAIM',
          title: 'Critical claim without evidence',
          insightKey: 'insight-1',
          certainty: 'EVIDENCED',
          reviewStatus: 'CONFIRMED',
          evidenceLinks: [],
        },
      ]),
    } as unknown as jest.Mocked<InsightRepository>;

    const useCase = new GetReviewCompletionUseCase(
      prisma,
      traceabilityRepo,
      insightRepo,
    );

    const result = await useCase.execute('analysis-1');

    expect(result.isComplete).toBe(false);
    expect(result.blockingReasons).toContain('UNREVIEWED_TRACEABILITY_LINKS');
    expect(result.blockingReasons).toContain('CRITICAL_MISSING_EVIDENCE');
  });
});
