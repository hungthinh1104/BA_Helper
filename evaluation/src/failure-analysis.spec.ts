import { analyzeKeywordBaselineFailures } from './failure-analysis';
import type { EvaluationCase } from './types';
import type { MetricsReport } from '../metrics';

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

function buildMetricsReport(overrides: Partial<MetricsReport> = {}): MetricsReport {
  return {
    runId: 'metrics-v0-1',
    generatedAt: '2026-06-17T00:00:00.000Z',
    dataset: {
      caseCount: 1,
      groundTruthType: 'changed-files-proxy',
      evaluationLevel: 'file',
    },
    methods: [
      {
        method: 'keyword-baseline-v0',
        caseMetrics: [
          {
            caseId: 'case-001',
            repo: 'owner/repo',
            topKCount: 10,
            groundTruthFileCount: 1,
            retrievedUniqueFileCountAt10: 1,
            truePositiveFileCountAt10: 1,
            falsePositiveFileCountAt10: 0,
            falseNegativeFileCountAt10: 0,
            recallAt5: 1,
            recallAt10: 1,
            precisionAt5: 1,
            precisionAt10: 1,
            f1At5: 1,
            f1At10: 1,
            missedGroundTruthFiles: [],
            hitGroundTruthFiles: ['src/article.service.ts'],
            unexpectedTopKFiles: [],
          },
        ],
        aggregate: {
          macroRecallAt5: 1,
          macroRecallAt10: 1,
          macroPrecisionAt5: 1,
          macroPrecisionAt10: 1,
          macroF1At5: 1,
          macroF1At10: 1,
          totalCases: 1,
          totalGroundTruthFiles: 1,
          totalTruePositiveFilesAt10: 1,
          totalFalsePositiveFilesAt10: 0,
          totalFalseNegativeFilesAt10: 0,
        },
      },
    ],
    warnings: [],
    ...overrides,
  };
}

function buildKeywordResults(
  overrides: Partial<{
    recallAt10: number;
    results: Array<{
      rank: number;
      artifactKey: string;
      filePath: string;
      artifactType: string;
      score: number;
      matchedTokens: string[];
      retrievalReason: string;
    }>;
    missedGroundTruthFiles: string[];
    unexpectedTopKFiles: string[];
  }> = {},
) {
  return {
    runId: 'keyword-baseline-v0-10',
    generatedAt: '2026-06-17T00:00:00.000Z',
    method: 'keyword-baseline-v0' as const,
    topK: 10,
    cases: [
      {
        caseId: 'case-001',
        repo: 'owner/repo',
        requirementText: 'Fix article author relation',
        groundTruthFiles: ['src/article.service.ts'],
        results: [
          {
            rank: 1,
            artifactKey: 'file:src/article.service.ts',
            filePath: 'src/article.service.ts',
            artifactType: 'SERVICE_FILE',
            score: 7.5,
            matchedTokens: ['article'],
            retrievalReason: 'keyword overlap: article(filePath)',
          },
        ],
        summary: {
          groundTruthHitCount: overrides.recallAt10 === 0 ? 0 : 1,
          recallAt10: overrides.recallAt10 ?? 1,
          missedGroundTruthFiles: overrides.missedGroundTruthFiles ?? [],
          unexpectedTopKFiles: overrides.unexpectedTopKFiles ?? [],
        },
        ...('results' in overrides ? { results: overrides.results! } : {}),
      },
    ],
    warnings: [],
  };
}

describe('failure analysis', () => {
  it('classifies PASS_FULL when recallAt10 is 1', () => {
    const report = analyzeKeywordBaselineFailures({
      datasetCases: [buildDatasetCase()],
      keywordResults: buildKeywordResults(),
      metricsReport: buildMetricsReport(),
      generatedAt: '2026-06-17T00:00:00.000Z',
    });

    expect(report.cases[0]?.outcome).toBe('PASS_FULL');
  });

  it('classifies PASS_PARTIAL when recallAt10 is between 0 and 1', () => {
    const report = analyzeKeywordBaselineFailures({
      datasetCases: [buildDatasetCase()],
      keywordResults: buildKeywordResults({
        recallAt10: 0.5,
        missedGroundTruthFiles: ['src/profile.service.ts'],
        unexpectedTopKFiles: ['src/comment.entity.ts'],
      }),
      metricsReport: buildMetricsReport({
        methods: [
          {
            ...buildMetricsReport().methods[0],
            caseMetrics: [
              {
                ...buildMetricsReport().methods[0]!.caseMetrics[0]!,
                recallAt10: 0.5,
                precisionAt10: 0.5,
                f1At10: 0.5,
                missedGroundTruthFiles: ['src/profile.service.ts'],
                unexpectedTopKFiles: ['src/comment.entity.ts'],
                groundTruthFileCount: 2,
                truePositiveFileCountAt10: 1,
                falsePositiveFileCountAt10: 1,
                falseNegativeFileCountAt10: 1,
              },
            ],
          },
        ],
      }),
    });

    expect(report.cases[0]?.outcome).toBe('PASS_PARTIAL');
  });

  it('classifies FAIL_MISS when recallAt10 is 0', () => {
    const report = analyzeKeywordBaselineFailures({
      datasetCases: [buildDatasetCase()],
      keywordResults: buildKeywordResults({
        recallAt10: 0,
        results: [],
        missedGroundTruthFiles: ['src/article.service.ts'],
      }),
      metricsReport: buildMetricsReport({
        methods: [
          {
            ...buildMetricsReport().methods[0],
            caseMetrics: [
              {
                ...buildMetricsReport().methods[0]!.caseMetrics[0]!,
                recallAt10: 0,
                precisionAt10: 0,
                f1At10: 0,
                hitGroundTruthFiles: [],
                missedGroundTruthFiles: ['src/article.service.ts'],
                truePositiveFileCountAt10: 0,
                falseNegativeFileCountAt10: 1,
                retrievedUniqueFileCountAt10: 0,
              },
            ],
          },
        ],
      }),
    });

    expect(report.cases[0]?.outcome).toBe('FAIL_MISS');
  });

  it('assigns lexical mismatch conservatively on zero-overlap misses', () => {
    const report = analyzeKeywordBaselineFailures({
      datasetCases: [buildDatasetCase()],
      keywordResults: buildKeywordResults({
        recallAt10: 0,
        results: [],
        missedGroundTruthFiles: ['src/article.service.ts'],
      }),
      metricsReport: buildMetricsReport({
        methods: [
          {
            ...buildMetricsReport().methods[0],
            caseMetrics: [
              {
                ...buildMetricsReport().methods[0]!.caseMetrics[0]!,
                recallAt10: 0,
                precisionAt10: 0,
                f1At10: 0,
                hitGroundTruthFiles: [],
                missedGroundTruthFiles: ['src/article.service.ts'],
                retrievedUniqueFileCountAt10: 0,
                truePositiveFileCountAt10: 0,
                falseNegativeFileCountAt10: 1,
              },
            ],
          },
        ],
      }),
    });

    expect(report.cases[0]?.observedFailureCategories).toContain('LEXICAL_MISMATCH');
  });

  it('does not assign graph, llm, or vector observed categories without evidence', () => {
    const report = analyzeKeywordBaselineFailures({
      datasetCases: [buildDatasetCase()],
      keywordResults: buildKeywordResults({
        recallAt10: 0,
        results: [],
        missedGroundTruthFiles: ['src/article.service.ts'],
      }),
      metricsReport: buildMetricsReport({
        methods: [
          {
            ...buildMetricsReport().methods[0],
            caseMetrics: [
              {
                ...buildMetricsReport().methods[0]!.caseMetrics[0]!,
                recallAt10: 0,
                precisionAt10: 0,
                f1At10: 0,
                hitGroundTruthFiles: [],
                missedGroundTruthFiles: ['src/article.service.ts'],
                retrievedUniqueFileCountAt10: 0,
                truePositiveFileCountAt10: 0,
                falseNegativeFileCountAt10: 1,
              },
            ],
          },
        ],
      }),
    });

    expect(report.cases[0]?.observedFailureCategories).not.toEqual(
      expect.arrayContaining([
        'VECTOR_THIN_CHUNK',
        'GRAPH_EDGE_MISSING',
        'GRAPH_NOISE',
        'LLM_EVIDENCE_OVERCLAIM',
      ]),
    );
  });

  it('aggregates category counts', () => {
    const report = analyzeKeywordBaselineFailures({
      datasetCases: [
        buildDatasetCase(),
        buildDatasetCase({
          id: 'case-002',
          candidateArtifacts: [
            {
              artifactKey: 'file:src/article.service.ts',
              filePath: 'src/article.service.ts',
              artifactName: 'article.service.ts',
              artifactType: 'SERVICE_FILE',
            },
          ],
        }),
      ],
      keywordResults: {
        runId: 'keyword-baseline-v0-10',
        generatedAt: '2026-06-17T00:00:00.000Z',
        method: 'keyword-baseline-v0',
        topK: 10,
        cases: [
          buildKeywordResults({
            recallAt10: 0,
            results: [],
            missedGroundTruthFiles: ['src/article.service.ts'],
          }).cases[0],
          {
            caseId: 'case-002',
            repo: 'owner/repo',
            requirementText: 'Fix article author relation',
            groundTruthFiles: ['src/missing.entity.ts'],
            results: [],
            summary: {
              groundTruthHitCount: 0,
              recallAt10: 0,
              missedGroundTruthFiles: ['src/missing.entity.ts'],
              unexpectedTopKFiles: [],
            },
          },
        ],
        warnings: [],
      },
      metricsReport: {
        ...buildMetricsReport(),
        dataset: {
          caseCount: 2,
          groundTruthType: 'changed-files-proxy',
          evaluationLevel: 'file',
        },
        methods: [
          {
            ...buildMetricsReport().methods[0],
            caseMetrics: [
              {
                ...buildMetricsReport().methods[0]!.caseMetrics[0]!,
                recallAt10: 0,
                precisionAt10: 0,
                f1At10: 0,
                hitGroundTruthFiles: [],
                missedGroundTruthFiles: ['src/article.service.ts'],
                retrievedUniqueFileCountAt10: 0,
                truePositiveFileCountAt10: 0,
                falseNegativeFileCountAt10: 1,
              },
              {
                caseId: 'case-002',
                repo: 'owner/repo',
                topKCount: 10,
                groundTruthFileCount: 1,
                retrievedUniqueFileCountAt10: 0,
                truePositiveFileCountAt10: 0,
                falsePositiveFileCountAt10: 0,
                falseNegativeFileCountAt10: 1,
                recallAt5: 0,
                recallAt10: 0,
                precisionAt5: 0,
                precisionAt10: 0,
                f1At5: 0,
                f1At10: 0,
                missedGroundTruthFiles: ['src/missing.entity.ts'],
                hitGroundTruthFiles: [],
                unexpectedTopKFiles: [],
              },
            ],
            aggregate: buildMetricsReport().methods[0]!.aggregate,
          },
        ],
      },
    });

    expect(report.summary.categoryCounts.LEXICAL_MISMATCH).toBe(1);
    expect(report.summary.categoryCounts.SCANNER_MISSING_ARTIFACT).toBe(1);
  });

  it('keeps hypotheses separate from observed failures', () => {
    const report = analyzeKeywordBaselineFailures({
      datasetCases: [buildDatasetCase()],
      keywordResults: buildKeywordResults({
        recallAt10: 0,
        results: [],
        missedGroundTruthFiles: ['src/article.service.ts'],
      }),
      metricsReport: buildMetricsReport({
        methods: [
          {
            ...buildMetricsReport().methods[0],
            caseMetrics: [
              {
                ...buildMetricsReport().methods[0]!.caseMetrics[0]!,
                recallAt10: 0,
                precisionAt10: 0,
                f1At10: 0,
                hitGroundTruthFiles: [],
                missedGroundTruthFiles: ['src/article.service.ts'],
                retrievedUniqueFileCountAt10: 0,
                truePositiveFileCountAt10: 0,
                falseNegativeFileCountAt10: 1,
              },
            ],
          },
        ],
      }),
    });

    expect(report.cases[0]?.observedFailureCategories).toContain('LEXICAL_MISMATCH');
    expect(report.cases[0]?.hypothesesForFutureEvaluation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          needsEvidenceFrom: 'VECTOR_BASELINE',
        }),
      ]),
    );
    expect(report.cases[0]?.observedFailureCategories).not.toContain(
      'VECTOR_THIN_CHUNK',
    );
  });
});
