import {
  aggregateCaseMetrics,
  computeCaseMetrics,
  computeMethodMetrics,
} from '../../metrics';

describe('evaluation metrics', () => {
  it('calculates recall@K correctly', () => {
    const metrics = computeCaseMetrics({
      caseId: 'case-001',
      repo: 'owner/repo',
      groundTruthFiles: ['a.ts', 'b.ts'],
      retrievedResults: [{ filePath: 'a.ts' }, { filePath: 'x.ts' }],
      topKCount: 10,
    });

    expect(metrics.recallAt5).toBe(0.5);
    expect(metrics.recallAt10).toBe(0.5);
  });

  it('calculates precision@K correctly', () => {
    const metrics = computeCaseMetrics({
      caseId: 'case-001',
      repo: 'owner/repo',
      groundTruthFiles: ['a.ts', 'b.ts'],
      retrievedResults: [{ filePath: 'a.ts' }, { filePath: 'x.ts' }],
      topKCount: 10,
    });

    expect(metrics.precisionAt5).toBe(0.5);
    expect(metrics.precisionAt10).toBe(0.5);
  });

  it('returns F1 as zero when precision and recall are both zero', () => {
    const metrics = computeCaseMetrics({
      caseId: 'case-001',
      repo: 'owner/repo',
      groundTruthFiles: ['a.ts'],
      retrievedResults: [{ filePath: 'x.ts' }],
      topKCount: 10,
    });

    expect(metrics.f1At5).toBe(0);
    expect(metrics.f1At10).toBe(0);
  });

  it('deduplicates retrieved file paths before computing metrics', () => {
    const metrics = computeCaseMetrics({
      caseId: 'case-001',
      repo: 'owner/repo',
      groundTruthFiles: ['a.ts'],
      retrievedResults: [
        { filePath: 'a.ts' },
        { filePath: 'a.ts' },
        { filePath: 'x.ts' },
      ],
      topKCount: 10,
    });

    expect(metrics.retrievedUniqueFileCountAt10).toBe(2);
    expect(metrics.retrievedUniqueFileCountAt5).toBe(2);
    expect(metrics.truePositiveFileCountAt10).toBe(1);
    expect(metrics.falsePositiveFileCountAt10).toBe(1);
  });

  it('computes review burden when true positives are present', () => {
    const metrics = computeCaseMetrics({
      caseId: 'case-001',
      repo: 'owner/repo',
      groundTruthFiles: ['a.ts'],
      retrievedResults: [{ filePath: 'a.ts' }, { filePath: 'x.ts' }],
      topKCount: 10,
    });

    expect(metrics.reviewBurdenAt5).toBe(2);
    expect(metrics.reviewBurdenAt10).toBe(2);
    expect(metrics.noHitBurdenAt10).toBe(false);
  });

  it('computes no-hit review burden when true positives are zero', () => {
    const metrics = computeCaseMetrics({
      caseId: 'case-001',
      repo: 'owner/repo',
      groundTruthFiles: ['a.ts'],
      retrievedResults: [{ filePath: 'x.ts' }, { filePath: 'y.ts' }],
      topKCount: 10,
    });

    expect(metrics.reviewBurdenAt10).toBe(2);
    expect(metrics.noHitBurdenAt10).toBe(true);
  });

  it('computes hit and missed ground-truth files exactly', () => {
    const metrics = computeCaseMetrics({
      caseId: 'case-001',
      repo: 'owner/repo',
      groundTruthFiles: ['src/a.ts', 'src/b.ts'],
      retrievedResults: [{ filePath: 'src/b.ts' }, { filePath: 'src/c.ts' }],
      topKCount: 10,
    });

    expect(metrics.hitGroundTruthFiles).toEqual(['src/b.ts']);
    expect(metrics.missedGroundTruthFiles).toEqual(['src/a.ts']);
    expect(metrics.unexpectedTopKFiles).toEqual(['src/c.ts']);
  });

  it('computes macro averages across cases', () => {
    const method = computeMethodMetrics({
      methodResult: {
        runId: 'run-001',
        generatedAt: '2026-06-17T00:00:00.000Z',
        method: 'keyword-baseline-v0',
        topK: 10,
        cases: [
          {
            caseId: 'case-001',
            repo: 'owner/repo',
            groundTruthFiles: ['a.ts'],
            results: [{ filePath: 'a.ts' }],
          },
          {
            caseId: 'case-002',
            repo: 'owner/repo',
            groundTruthFiles: ['b.ts'],
            results: [{ filePath: 'x.ts' }],
          },
        ],
      },
      cleanRetrievalExcludedCaseIds: new Set(['case-002']),
    });

    expect(method.aggregate.macroRecallAt10).toBe(0.5);
    expect(method.aggregate.macroPrecisionAt10).toBe(0.5);
    expect(method.aggregate.macroF1At10).toBe(0.5);
    expect(method.aggregate.macroReviewBurdenAt10).toBe(1);
    expect(method.aggregate.noHitCaseCountAt10).toBe(1);
    expect(method.cleanRetrievalAggregate?.macroRecallAt10).toBe(1);
    expect(method.cleanRetrievalAggregate?.totalCases).toBe(1);
  });

  it('matches exact file paths, not substring matches', () => {
    const metrics = computeCaseMetrics({
      caseId: 'case-001',
      repo: 'owner/repo',
      groundTruthFiles: ['src/user.ts'],
      retrievedResults: [{ filePath: 'src/user.ts.bak' }],
      topKCount: 10,
    });

    expect(metrics.truePositiveFileCountAt10).toBe(0);
    expect(metrics.falseNegativeFileCountAt10).toBe(1);
  });

  it('aggregates total counts correctly', () => {
    const aggregate = aggregateCaseMetrics([
      {
        caseId: 'case-001',
        repo: 'owner/repo',
        topKCount: 10,
        groundTruthFileCount: 2,
        retrievedUniqueFileCountAt5: 2,
        retrievedUniqueFileCountAt10: 2,
        truePositiveFileCountAt5: 1,
        truePositiveFileCountAt10: 1,
        falsePositiveFileCountAt5: 1,
        falsePositiveFileCountAt10: 1,
        falseNegativeFileCountAt5: 1,
        falseNegativeFileCountAt10: 1,
        recallAt5: 0.5,
        recallAt10: 0.5,
        precisionAt5: 0.5,
        precisionAt10: 0.5,
        f1At5: 0.5,
        f1At10: 0.5,
        reviewBurdenAt5: 2,
        reviewBurdenAt10: 2,
        noHitBurdenAt5: false,
        noHitBurdenAt10: false,
        missedGroundTruthFiles: ['b.ts'],
        hitGroundTruthFiles: ['a.ts'],
        unexpectedTopKFiles: ['x.ts'],
      },
      {
        caseId: 'case-002',
        repo: 'owner/repo',
        topKCount: 10,
        groundTruthFileCount: 1,
        retrievedUniqueFileCountAt5: 1,
        retrievedUniqueFileCountAt10: 1,
        truePositiveFileCountAt5: 0,
        truePositiveFileCountAt10: 0,
        falsePositiveFileCountAt5: 1,
        falsePositiveFileCountAt10: 1,
        falseNegativeFileCountAt5: 1,
        falseNegativeFileCountAt10: 1,
        recallAt5: 0,
        recallAt10: 0,
        precisionAt5: 0,
        precisionAt10: 0,
        f1At5: 0,
        f1At10: 0,
        reviewBurdenAt5: 1,
        reviewBurdenAt10: 1,
        noHitBurdenAt5: true,
        noHitBurdenAt10: true,
        missedGroundTruthFiles: ['c.ts'],
        hitGroundTruthFiles: [],
        unexpectedTopKFiles: ['y.ts'],
      },
    ]);

    expect(aggregate.totalCases).toBe(2);
    expect(aggregate.totalGroundTruthFiles).toBe(3);
    expect(aggregate.totalTruePositiveFilesAt10).toBe(1);
    expect(aggregate.totalFalsePositiveFilesAt10).toBe(2);
    expect(aggregate.totalFalseNegativeFilesAt10).toBe(2);
    expect(aggregate.macroReviewBurdenAt10).toBe(1.5);
    expect(aggregate.noHitCaseCountAt10).toBe(1);
  });
});
