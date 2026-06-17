import { analyzeLexicalBaselineFailures, classifyOutcome } from './failure-analysis';
import type { EvaluationCase } from './types';
import type { MetricsReport } from '../metrics';
import type { NormalizedResultMethod } from './result-registry';

function buildDatasetCase(overrides: Partial<EvaluationCase> = {}): EvaluationCase {
  return {
    id: 'case-001',
    repo: 'owner/repo',
    baseSha: 'abc123',
    requirementText: 'Fix article author relation',
    groundTruth: {
      files: ['src/article.service.ts'],
    },
    candidateArtifacts: [
      {
        artifactKey: 'file:src/article.service.ts',
        filePath: 'src/article.service.ts',
        artifactName: 'article.service.ts',
        artifactType: 'SERVICE_FILE',
      },
      {
        artifactKey: 'file:src/comment.entity.ts',
        filePath: 'src/comment.entity.ts',
        artifactName: 'comment.entity.ts',
        artifactType: 'ENTITY_FILE',
      },
    ],
    ...overrides,
  };
}

function buildCaseMetric(overrides: Partial<MetricsReport['methods'][number]['caseMetrics'][number]> = {}) {
  return {
    caseId: 'case-001',
    repo: 'owner/repo',
    topKCount: 10,
    groundTruthFileCount: 1,
    retrievedUniqueFileCountAt5: 1,
    retrievedUniqueFileCountAt10: 1,
    truePositiveFileCountAt5: 1,
    truePositiveFileCountAt10: 1,
    falsePositiveFileCountAt5: 0,
    falsePositiveFileCountAt10: 0,
    falseNegativeFileCountAt5: 0,
    falseNegativeFileCountAt10: 0,
    recallAt5: 1,
    recallAt10: 1,
    precisionAt5: 1,
    precisionAt10: 1,
    f1At5: 1,
    f1At10: 1,
    reviewBurdenAt5: 1,
    reviewBurdenAt10: 1,
    noHitBurdenAt5: false,
    noHitBurdenAt10: false,
    missedGroundTruthFiles: [],
    hitGroundTruthFiles: ['src/article.service.ts'],
    unexpectedTopKFiles: [],
    ...overrides,
  };
}

function buildMetricsReport(): MetricsReport {
  return {
    runId: 'metrics-v0-2',
    generatedAt: '2026-06-17T00:00:00.000Z',
    dataset: {
      caseCount: 1,
      groundTruthType: 'changed-files-proxy',
      evaluationLevel: 'file',
    },
    methods: [
      {
        method: 'keyword-baseline-v0',
        sourceFile: 'keyword-baseline.v0.json',
        caseMetrics: [buildCaseMetric()],
        aggregate: {
          macroRecallAt5: 1,
          macroRecallAt10: 1,
          macroPrecisionAt5: 1,
          macroPrecisionAt10: 1,
          macroF1At5: 1,
          macroF1At10: 1,
          macroReviewBurdenAt5: 1,
          macroReviewBurdenAt10: 1,
          noHitCaseCountAt10: 0,
          totalCases: 1,
          totalGroundTruthFiles: 1,
          totalTruePositiveFilesAt10: 1,
          totalFalsePositiveFilesAt10: 0,
          totalFalseNegativeFilesAt10: 0,
        },
      },
      {
        method: 'bm25-baseline-v0',
        sourceFile: 'bm25-baseline.v0.json',
        caseMetrics: [buildCaseMetric()],
        aggregate: {
          macroRecallAt5: 1,
          macroRecallAt10: 1,
          macroPrecisionAt5: 1,
          macroPrecisionAt10: 1,
          macroF1At5: 1,
          macroF1At10: 1,
          macroReviewBurdenAt5: 1,
          macroReviewBurdenAt10: 1,
          noHitCaseCountAt10: 0,
          totalCases: 1,
          totalGroundTruthFiles: 1,
          totalTruePositiveFilesAt10: 1,
          totalFalsePositiveFilesAt10: 0,
          totalFalseNegativeFilesAt10: 0,
        },
      },
    ],
    warnings: [],
  };
}

function buildMethodResult(method: string, topFile = 'src/article.service.ts'): NormalizedResultMethod {
  return {
    sourceFile: `${method}.json`,
    method,
    generatedAt: '2026-06-17T00:00:00.000Z',
    topK: 10,
    cases: [
      {
        caseId: 'case-001',
        repo: 'owner/repo',
        requirementText: 'Fix article author relation',
        groundTruthFiles: ['src/article.service.ts'],
        rankedResults: [
          {
            rank: 1,
            artifactKey: `file:${topFile}`,
            filePath: topFile,
            artifactType: 'SERVICE_FILE',
            score: 1,
          },
        ],
      },
    ],
  };
}

describe('failure analysis multi-method', () => {
  it('preserves PASS_FULL PASS_PARTIAL FAIL_MISS classification', () => {
    expect(classifyOutcome(1)).toBe('PASS_FULL');
    expect(classifyOutcome(0.5)).toBe('PASS_PARTIAL');
    expect(classifyOutcome(0)).toBe('FAIL_MISS');
  });

  it('analyzes multiple methods from registry', () => {
    const report = analyzeLexicalBaselineFailures({
      datasetCases: [buildDatasetCase()],
      methods: [
        buildMethodResult('keyword-baseline-v0'),
        buildMethodResult('bm25-baseline-v0'),
      ],
      metricsReport: buildMetricsReport(),
    });

    expect(report.methods.map((method) => method.method)).toEqual([
      'keyword-baseline-v0',
      'bm25-baseline-v0',
    ]);
  });

  it('handles missing vector result as warning not failure', () => {
    const report = analyzeLexicalBaselineFailures({
      datasetCases: [buildDatasetCase()],
      methods: [buildMethodResult('keyword-baseline-v0')],
      metricsReport: {
        ...buildMetricsReport(),
        methods: [buildMetricsReport().methods[0]!],
        warnings: ['Optional result file not found: vector-baseline.v0.json'],
      },
      warnings: ['Optional result file not found: vector-baseline.v0.json'],
    });

    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('vector-baseline.v0.json'),
      ]),
    );
  });

  it('computes improvement tie regression by R@10', () => {
    const report = analyzeLexicalBaselineFailures({
      datasetCases: [buildDatasetCase()],
      methods: [
        buildMethodResult('keyword-baseline-v0'),
        buildMethodResult('bm25-baseline-v0', 'src/comment.entity.ts'),
      ],
      metricsReport: {
        ...buildMetricsReport(),
        methods: [
          {
            ...buildMetricsReport().methods[0]!,
            caseMetrics: [buildCaseMetric({ recallAt10: 0.5, precisionAt10: 0.5, f1At10: 0.5 })],
          },
          {
            ...buildMetricsReport().methods[1]!,
            caseMetrics: [buildCaseMetric({ recallAt10: 0.5, precisionAt10: 0.5, f1At10: 0.5 })],
          },
        ],
      },
    });

    expect(report.crossMethodComparison[0]?.bm25VsKeywordRecallAt10).toBe('TIED');
    expect(report.crossMethodComparison[0]?.bm25ChangedTopRankedFiles).toBe(true);
  });

  it('does not assign vector graph or llm categories for lexical methods', () => {
    const report = analyzeLexicalBaselineFailures({
      datasetCases: [buildDatasetCase()],
      methods: [
        {
          ...buildMethodResult('keyword-baseline-v0'),
          cases: [
            {
              ...buildMethodResult('keyword-baseline-v0').cases[0]!,
              rankedResults: [],
            },
          ],
        },
      ],
      metricsReport: {
        ...buildMetricsReport(),
        methods: [
          {
            ...buildMetricsReport().methods[0]!,
            caseMetrics: [
              buildCaseMetric({
                recallAt10: 0,
                precisionAt10: 0,
                f1At10: 0,
                recallAt5: 0,
                precisionAt5: 0,
                f1At5: 0,
                hitGroundTruthFiles: [],
                missedGroundTruthFiles: ['src/article.service.ts'],
                truePositiveFileCountAt5: 0,
                truePositiveFileCountAt10: 0,
                falseNegativeFileCountAt5: 1,
                falseNegativeFileCountAt10: 1,
                retrievedUniqueFileCountAt5: 0,
                retrievedUniqueFileCountAt10: 0,
                noHitBurdenAt5: true,
                noHitBurdenAt10: true,
              }),
            ],
          },
        ],
      },
    });

    expect(report.methods[0]?.cases[0]?.observedFailureCategories).not.toEqual(
      expect.arrayContaining([
        'VECTOR_THIN_CHUNK',
        'GRAPH_EDGE_MISSING',
        'GRAPH_NOISE',
        'LLM_EVIDENCE_OVERCLAIM',
      ]),
    );
  });

  it('keeps future hypotheses separate from observed categories', () => {
    const report = analyzeLexicalBaselineFailures({
      datasetCases: [buildDatasetCase()],
      methods: [
        {
          ...buildMethodResult('keyword-baseline-v0'),
          cases: [
            {
              ...buildMethodResult('keyword-baseline-v0').cases[0]!,
              rankedResults: [],
            },
          ],
        },
      ],
      metricsReport: {
        ...buildMetricsReport(),
        methods: [
          {
            ...buildMetricsReport().methods[0]!,
            caseMetrics: [
              buildCaseMetric({
                recallAt10: 0,
                precisionAt10: 0,
                f1At10: 0,
                recallAt5: 0,
                precisionAt5: 0,
                f1At5: 0,
                hitGroundTruthFiles: [],
                missedGroundTruthFiles: ['src/article.service.ts'],
                truePositiveFileCountAt5: 0,
                truePositiveFileCountAt10: 0,
                falseNegativeFileCountAt5: 1,
                falseNegativeFileCountAt10: 1,
                retrievedUniqueFileCountAt5: 0,
                retrievedUniqueFileCountAt10: 0,
                noHitBurdenAt5: true,
                noHitBurdenAt10: true,
              }),
            ],
          },
        ],
      },
    });

    expect(report.methods[0]?.cases[0]?.observedFailureCategories).toContain('LEXICAL_MISMATCH');
    expect(report.methods[0]?.cases[0]?.observedFailureCategories).not.toContain('VECTOR_THIN_CHUNK');
    expect(report.methods[0]?.cases[0]?.hypothesesForFutureEvaluation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          needsEvidenceFrom: 'VECTOR_BASELINE',
        }),
      ]),
    );
  });
});
