import { GetImpactDiffUseCase } from './get-impact-diff.usecase';
import { PrismaService } from '../../../prisma/prisma.service';

describe('GetImpactDiffUseCase', () => {
  let useCase: GetImpactDiffUseCase;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      impactAnalysis: { findUnique: jest.fn() },
      traceabilityLink: { findMany: jest.fn() },
      baInsight: { findMany: jest.fn() },
      clarificationItem: { findUnique: jest.fn() },
    } as unknown as jest.Mocked<PrismaService>;

    useCase = new GetImpactDiffUseCase(prisma);
  });

  const mockBaseAnalysis = {
    id: 'base-analysis',
    requirementRevisionId: 'rev-1',
    snapshotId: 'snap-1',
    status: 'COMPLETED',
    snapshot: { commitSha: 'abc1234' },
  };

  const mockCurrentAnalysis = {
    id: 'current-analysis',
    requirementRevisionId: 'rev-2',
    snapshotId: 'snap-2',
    status: 'COMPLETED',
    derivedFromAnalysisId: 'base-analysis',
    sourceClarificationId: 'clar-1',
    reviewClarificationRequestId: '00000000-0000-4000-8000-000000000111',
    snapshot: { commitSha: 'def5678' },
  };

  it('rejects if current analysis not found', async () => {
    (prisma.impactAnalysis.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(useCase.execute('current-analysis')).rejects.toMatchObject({
      code: 'ANALYSIS_NOT_FOUND',
    });
  });

  it('rejects if no derivedFromAnalysisId', async () => {
    (prisma.impactAnalysis.findUnique as jest.Mock).mockResolvedValue({
      ...mockCurrentAnalysis,
      derivedFromAnalysisId: null,
    });
    await expect(useCase.execute('current-analysis')).rejects.toMatchObject({
      code: 'NO_BASELINE_ANALYSIS',
    });
  });

  it('rejects if analysis is running', async () => {
    (prisma.impactAnalysis.findUnique as jest.Mock).mockResolvedValue({
      ...mockCurrentAnalysis,
      status: 'RUNNING',
    });
    await expect(useCase.execute('current-analysis')).rejects.toMatchObject({
      code: 'DIFF_NOT_READY',
    });
  });

  it('calculates impact diff correctly', async () => {
    (prisma.impactAnalysis.findUnique as jest.Mock).mockImplementation(async (args) => {
      if (args.where.id === 'current-analysis') return mockCurrentAnalysis;
      if (args.where.id === 'base-analysis') return mockBaseAnalysis;
      return null;
    });

    (prisma.traceabilityLink.findMany as jest.Mock).mockImplementation(async (args) => {
      if (args.where.impactAnalysisId === 'base-analysis') {
        return [
          { artifact: { artifactKey: 'art-1', name: 'File1', artifactType: 'FILE', universalKind: 'UNKNOWN' }, reviewStatus: 'CONFIRMED' },
          { artifact: { artifactKey: 'art-2', name: 'File2', artifactType: 'FILE', universalKind: 'UNKNOWN' }, reviewStatus: 'CONFIRMED' }, // removed
        ];
      }
      if (args.where.impactAnalysisId === 'current-analysis') {
        return [
          { artifact: { artifactKey: 'art-1', name: 'File1', artifactType: 'FILE', universalKind: 'UNKNOWN' }, reviewStatus: 'CONFIRMED' },
          { artifact: { artifactKey: 'art-3', name: 'File3', artifactType: 'FILE', universalKind: 'UNKNOWN' }, reviewStatus: 'NEEDS_REVIEW' }, // added
        ];
      }
      return [];
    });

    (prisma.baInsight.findMany as jest.Mock).mockImplementation(async (args) => {
      if (args.where.impactAnalysisId === 'base-analysis') {
        return [
          { id: 'insight-u1', insightType: 'UNKNOWN', insightKey: 'u1', title: 'Q1', description: 'Stmt1', reviewStatus: 'CONFIRMED' }, // resolved (has lineage)
          { id: 'insight-u2', insightType: 'UNKNOWN', insightKey: 'u2', title: 'Q2', description: 'Stmt2', reviewStatus: 'CONFIRMED' }, // removed (no lineage)
          { id: 'insight-q1', insightType: 'QA_SCENARIO', insightKey: 'q1', title: 'QA1', description: 'Stmt3', reviewStatus: 'CONFIRMED' }, // unchanged
        ];
      }
      if (args.where.impactAnalysisId === 'current-analysis') {
        return [
          { id: 'insight-q1', insightType: 'QA_SCENARIO', insightKey: 'q1', title: 'QA1', description: 'Stmt3', reviewStatus: 'CONFIRMED' }, // unchanged
          { id: 'insight-u3', insightType: 'UNKNOWN', insightKey: 'u3', title: 'Q3', description: 'Stmt4', reviewStatus: 'NEEDS_REVIEW' }, // new unknown
          { id: 'insight-q2', insightType: 'QA_SCENARIO', insightKey: 'q2', title: 'QA2', description: 'Stmt5', reviewStatus: 'NEEDS_REVIEW' }, // added qa scenario
        ];
      }
      return [];
    });

    (prisma.clarificationItem.findUnique as jest.Mock).mockResolvedValue({
      id: 'clar-1',
      sourceInsightId: 'insight-u1',
    });

    const result = await useCase.execute('current-analysis');

    expect(result.comparisonContext.requirementChanged).toBe(true);
    expect(result.comparisonContext.snapshotChanged).toBe(true);
    expect(result.comparisonContext.baseCommitSha).toBe('abc1234');
    expect(result.comparisonContext.currentCommitSha).toBe('def5678');
    expect(result.comparisonContext.sourceClarificationId).toBe('clar-1');
    expect(result.comparisonContext.reviewClarificationRequestId).toBe('00000000-0000-4000-8000-000000000111');

    expect(result.summary.addedImpacts).toBe(1);
    expect(result.summary.removedImpacts).toBe(1);
    expect(result.summary.unchangedImpacts).toBe(1);
    expect(result.summary.resolvedUnknowns).toBe(1);
    expect(result.summary.removedUnknowns).toBe(1);
    expect(result.summary.newUnknowns).toBe(1);
    expect(result.summary.addedQaScenarios).toBe(1);

    expect(result.addedArtifacts[0].artifactKey).toBe('art-3');
    expect(result.addedArtifacts[0].universalKind).toBe('UNKNOWN');
    expect(result.removedArtifacts[0].artifactKey).toBe('art-2');
    expect(result.unchangedArtifacts[0].artifactKey).toBe('art-1');

    expect(result.resolvedUnknowns[0].insightKey).toBe('u1');
    expect(result.removedUnknowns[0].insightKey).toBe('u2');
    expect(result.newUnknowns[0].insightKey).toBe('u3');
    expect(result.addedQaScenarios[0].insightKey).toBe('q2');

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics?.[0].code).toBe('SNAPSHOT_CHANGED');
  });
});
