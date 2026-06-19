import type { BaselinePrediction, EvaluationCase, MetricsSummary } from './types';
import type { NormalizedResultMethod } from './src/analysis/result-registry';

const TOP_K_5 = 5;
const TOP_K_10 = 10;

export type RetrievalCaseLike = {
  caseId: string;
  repo: string;
  groundTruthFiles: string[];
  results: Array<{
    filePath: string;
  }>;
};

export type MethodResultFileLike = {
  runId: string;
  generatedAt: string;
  method: string;
  topK: number;
  sourceFile?: string;
  cases: RetrievalCaseLike[];
};

export type CaseMetrics = {
  caseId: string;
  repo: string;
  topKCount: number;
  groundTruthFileCount: number;
  retrievedUniqueFileCountAt5: number;
  retrievedUniqueFileCountAt10: number;
  truePositiveFileCountAt5: number;
  truePositiveFileCountAt10: number;
  falsePositiveFileCountAt5: number;
  falsePositiveFileCountAt10: number;
  falseNegativeFileCountAt5: number;
  falseNegativeFileCountAt10: number;
  recallAt5: number;
  recallAt10: number;
  precisionAt5: number;
  precisionAt10: number;
  f1At5: number;
  f1At10: number;
  reviewBurdenAt5: number;
  reviewBurdenAt10: number;
  noHitBurdenAt5: boolean;
  noHitBurdenAt10: boolean;
  missedGroundTruthFiles: string[];
  hitGroundTruthFiles: string[];
  unexpectedTopKFiles: string[];
};

export type AggregateMetrics = {
  macroRecallAt5: number;
  macroRecallAt10: number;
  macroPrecisionAt5: number;
  macroPrecisionAt10: number;
  macroF1At5: number;
  macroF1At10: number;
  macroReviewBurdenAt5: number;
  macroReviewBurdenAt10: number;
  noHitCaseCountAt10: number;
  totalCases: number;
  totalGroundTruthFiles: number;
  totalTruePositiveFilesAt10: number;
  totalFalsePositiveFilesAt10: number;
  totalFalseNegativeFilesAt10: number;
};

export type MethodMetricsReport = {
  method: string;
  sourceFile?: string;
  caseMetrics: CaseMetrics[];
  aggregate: AggregateMetrics;
  cleanRetrievalAggregate?: AggregateMetrics;
};

export type MetricsReport = {
  runId: string;
  generatedAt: string;
  dataset: {
    caseCount: number;
    scannerCoverageFailureCaseCount?: number;
    scannerCoverageFailureCaseCountSource?: 'DATASET_METADATA' | 'DB_ALIGNMENT';
    groundTruthType: 'changed-files-proxy';
    evaluationLevel: 'file';
  };
  methods: MethodMetricsReport[];
  warnings: string[];
};

function divideSafe(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function dedupeFilePaths(results: Array<{ filePath: string }>, topK: number): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const result of results) {
    if (unique.length >= topK) {
      break;
    }
    if (!seen.has(result.filePath)) {
      seen.add(result.filePath);
      unique.push(result.filePath);
    }
  }

  return unique;
}

function intersectExact(left: string[], rightSet: Set<string>): string[] {
  return left.filter((value) => rightSet.has(value));
}

function differenceExact(left: string[], rightSet: Set<string>): string[] {
  return left.filter((value) => !rightSet.has(value));
}

function calculateF1(precision: number, recall: number): number {
  return precision + recall === 0
    ? 0
    : roundMetric((2 * precision * recall) / (precision + recall));
}

function calculateReviewBurden(
  retrievedUniqueFileCount: number,
  truePositiveFileCount: number,
): { value: number; noHitBurden: boolean } {
  if (truePositiveFileCount === 0) {
    return {
      value: roundMetric(retrievedUniqueFileCount),
      noHitBurden: true,
    };
  }

  return {
    value: roundMetric(retrievedUniqueFileCount / truePositiveFileCount),
    noHitBurden: false,
  };
}

export function computeCaseMetrics(params: {
  caseId: string;
  repo: string;
  groundTruthFiles: string[];
  retrievedResults: Array<{ filePath: string }>;
  topKCount: number;
}): CaseMetrics {
  const groundTruthFiles = [...params.groundTruthFiles];
  const groundTruthSet = new Set(groundTruthFiles);
  const retrievedAt5 = dedupeFilePaths(params.retrievedResults, TOP_K_5);
  const retrievedAt10 = dedupeFilePaths(params.retrievedResults, TOP_K_10);
  const retrievedAt10Set = new Set(retrievedAt10);
  const retrievedAt5Set = new Set(retrievedAt5);

  const hitGroundTruthFiles = intersectExact(groundTruthFiles, retrievedAt10Set);
  const missedGroundTruthFiles = differenceExact(groundTruthFiles, retrievedAt10Set);
  const unexpectedTopKFiles = differenceExact(retrievedAt10, groundTruthSet);

  const truePositiveAt5 = intersectExact(retrievedAt5, groundTruthSet).length;
  const truePositiveAt10 = hitGroundTruthFiles.length;
  const falsePositiveAt5 = differenceExact(retrievedAt5, groundTruthSet).length;
  const falsePositiveAt10 = differenceExact(retrievedAt10, groundTruthSet).length;
  const falseNegativeAt5 = differenceExact(groundTruthFiles, retrievedAt5Set).length;
  const falseNegativeAt10 = missedGroundTruthFiles.length;

  const recallAt5 = roundMetric(
    divideSafe(intersectExact(groundTruthFiles, retrievedAt5Set).length, groundTruthFiles.length),
  );
  const recallAt10 = roundMetric(divideSafe(truePositiveAt10, groundTruthFiles.length));
  const precisionAt5 = roundMetric(divideSafe(truePositiveAt5, retrievedAt5.length));
  const precisionAt10 = roundMetric(divideSafe(truePositiveAt10, retrievedAt10.length));
  const f1At5 = calculateF1(precisionAt5, recallAt5);
  const f1At10 = calculateF1(precisionAt10, recallAt10);
  const reviewBurdenAt5 = calculateReviewBurden(retrievedAt5.length, truePositiveAt5);
  const reviewBurdenAt10 = calculateReviewBurden(retrievedAt10.length, truePositiveAt10);

  return {
    caseId: params.caseId,
    repo: params.repo,
    topKCount: params.topKCount,
    groundTruthFileCount: groundTruthFiles.length,
    retrievedUniqueFileCountAt5: retrievedAt5.length,
    retrievedUniqueFileCountAt10: retrievedAt10.length,
    truePositiveFileCountAt5: truePositiveAt5,
    truePositiveFileCountAt10: truePositiveAt10,
    falsePositiveFileCountAt5: falsePositiveAt5,
    falsePositiveFileCountAt10: falsePositiveAt10,
    falseNegativeFileCountAt5: falseNegativeAt5,
    falseNegativeFileCountAt10: falseNegativeAt10,
    recallAt5,
    recallAt10,
    precisionAt5,
    precisionAt10,
    f1At5,
    f1At10,
    reviewBurdenAt5: reviewBurdenAt5.value,
    reviewBurdenAt10: reviewBurdenAt10.value,
    noHitBurdenAt5: reviewBurdenAt5.noHitBurden,
    noHitBurdenAt10: reviewBurdenAt10.noHitBurden,
    missedGroundTruthFiles,
    hitGroundTruthFiles,
    unexpectedTopKFiles,
  };
}

export function aggregateCaseMetrics(caseMetrics: CaseMetrics[]): AggregateMetrics {
  return {
    macroRecallAt5: roundMetric(
      divideSafe(
        caseMetrics.reduce((sum, metric) => sum + metric.recallAt5, 0),
        caseMetrics.length,
      ),
    ),
    macroRecallAt10: roundMetric(
      divideSafe(
        caseMetrics.reduce((sum, metric) => sum + metric.recallAt10, 0),
        caseMetrics.length,
      ),
    ),
    macroPrecisionAt5: roundMetric(
      divideSafe(
        caseMetrics.reduce((sum, metric) => sum + metric.precisionAt5, 0),
        caseMetrics.length,
      ),
    ),
    macroPrecisionAt10: roundMetric(
      divideSafe(
        caseMetrics.reduce((sum, metric) => sum + metric.precisionAt10, 0),
        caseMetrics.length,
      ),
    ),
    macroF1At5: roundMetric(
      divideSafe(
        caseMetrics.reduce((sum, metric) => sum + metric.f1At5, 0),
        caseMetrics.length,
      ),
    ),
    macroF1At10: roundMetric(
      divideSafe(
        caseMetrics.reduce((sum, metric) => sum + metric.f1At10, 0),
        caseMetrics.length,
      ),
    ),
    macroReviewBurdenAt5: roundMetric(
      divideSafe(
        caseMetrics.reduce((sum, metric) => sum + metric.reviewBurdenAt5, 0),
        caseMetrics.length,
      ),
    ),
    macroReviewBurdenAt10: roundMetric(
      divideSafe(
        caseMetrics.reduce((sum, metric) => sum + metric.reviewBurdenAt10, 0),
        caseMetrics.length,
      ),
    ),
    noHitCaseCountAt10: caseMetrics.filter((metric) => metric.noHitBurdenAt10).length,
    totalCases: caseMetrics.length,
    totalGroundTruthFiles: caseMetrics.reduce(
      (sum, metric) => sum + metric.groundTruthFileCount,
      0,
    ),
    totalTruePositiveFilesAt10: caseMetrics.reduce(
      (sum, metric) => sum + metric.truePositiveFileCountAt10,
      0,
    ),
    totalFalsePositiveFilesAt10: caseMetrics.reduce(
      (sum, metric) => sum + metric.falsePositiveFileCountAt10,
      0,
    ),
    totalFalseNegativeFilesAt10: caseMetrics.reduce(
      (sum, metric) => sum + metric.falseNegativeFileCountAt10,
      0,
    ),
  };
}

export function computeMethodMetrics(params: {
  methodResult: MethodResultFileLike;
  cleanRetrievalExcludedCaseIds?: Set<string>;
}): MethodMetricsReport {
  const { methodResult } = params;
  const caseMetrics = methodResult.cases.map((caseResult) =>
    computeCaseMetrics({
      caseId: caseResult.caseId,
      repo: caseResult.repo,
      groundTruthFiles: caseResult.groundTruthFiles,
      retrievedResults: caseResult.results,
      topKCount: methodResult.topK,
    }),
  );

  return {
    method: methodResult.method,
    sourceFile: 'sourceFile' in methodResult ? methodResult.sourceFile : undefined,
    caseMetrics,
    aggregate: aggregateCaseMetrics(caseMetrics),
    cleanRetrievalAggregate: aggregateCaseMetrics(
      caseMetrics.filter(
        (metric) => !params.cleanRetrievalExcludedCaseIds?.has(metric.caseId),
      ),
    ),
  };
}

export function buildMetricsReport(params: {
  methods: MethodResultFileLike[];
  datasetCaseCount: number;
  scannerCoverageFailureCaseIds?: string[];
  scannerCoverageFailureCaseCountSource?: 'DATASET_METADATA' | 'DB_ALIGNMENT';
  generatedAt?: string;
  runId?: string;
  warnings?: string[];
}): MetricsReport {
  const scannerCoverageFailureCaseIds = params.scannerCoverageFailureCaseIds ?? [];
  const cleanRetrievalExcludedCaseIds = new Set(scannerCoverageFailureCaseIds);

  return {
    runId: params.runId ?? `metrics-v0-${params.methods.length}`,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    dataset: {
      caseCount: params.datasetCaseCount,
      scannerCoverageFailureCaseCount: scannerCoverageFailureCaseIds.length,
      scannerCoverageFailureCaseCountSource: params.scannerCoverageFailureCaseCountSource,
      groundTruthType: 'changed-files-proxy',
      evaluationLevel: 'file',
    },
    methods: params.methods.map((methodResult) =>
      computeMethodMetrics({
        methodResult,
        cleanRetrievalExcludedCaseIds,
      }),
    ),
    warnings: [
      'Changed files are proxy ground truth, not absolute impacted files.',
      'Metrics are file-level only, not method-level.',
      ...(scannerCoverageFailureCaseIds.length > 0
        ? [
            `Clean retrieval aggregate excludes scanner coverage failure case(s): ${scannerCoverageFailureCaseIds.join(', ')}.`,
            'E2E aggregate includes all cases, including scanner coverage failures.',
          ]
        : []),
      ...(params.warnings ?? []),
    ],
  };
}

export function renderMetricsMarkdown(report: MetricsReport): string {
  const lines = [
    '# Metrics v0',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    'Changed files are proxy ground truth.',
    'File-level only.',
    'Keyword baseline is deterministic and does not use DB, embeddings, LLM, or HybridRetrievalService.',
    'High review burden means humans must inspect many retrieved files per true positive.',
    'If a case has zero true positives, burden is treated as all retrieved files being wasted review effort.',
    '',
    ...(report.dataset.scannerCoverageFailureCaseCountSource === 'DATASET_METADATA' 
      ? ['> [!WARNING]', '> **Metrics scope limitation:** The scanner coverage failure case count is derived from `DATASET_METADATA` (case.evaluationScope), which assumes offline context. This is NOT equivalent to live DB snapshot indexing coverage. Do not conflate this count with DB scanner coverage.', ''] 
      : []),
    '| Method | Aggregate | Cases | R@5 | R@10 | P@5 | P@10 | F1@5 | F1@10 | ReviewBurden@5 | ReviewBurden@10 | NoHitCases@10 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const method of report.methods) {
    const rows = [
      { label: 'E2E all cases', aggregate: method.aggregate },
      ...(method.cleanRetrievalAggregate
        ? [
            {
              label: 'Clean retrieval subset',
              aggregate: method.cleanRetrievalAggregate,
            },
          ]
        : []),
    ];

    for (const row of rows) {
      lines.push(
        `| ${method.method} | ${row.label} | ${row.aggregate.totalCases} | ${row.aggregate.macroRecallAt5.toFixed(4)} | ${row.aggregate.macroRecallAt10.toFixed(4)} | ${row.aggregate.macroPrecisionAt5.toFixed(4)} | ${row.aggregate.macroPrecisionAt10.toFixed(4)} | ${row.aggregate.macroF1At5.toFixed(4)} | ${row.aggregate.macroF1At10.toFixed(4)} | ${row.aggregate.macroReviewBurdenAt5.toFixed(4)} | ${row.aggregate.macroReviewBurdenAt10.toFixed(4)} | ${row.aggregate.noHitCaseCountAt10} |`,
      );
    }
    }

  lines.push(
    '',
    '| Case ID | Method | R@10 | P@10 | F1@10 | Hits | Missed Files |',
    '| --- | --- | ---: | ---: | ---: | --- | --- |',
  );

  for (const method of report.methods) {
    for (const metric of method.caseMetrics) {
      lines.push(
        `| ${metric.caseId} | ${method.method} | ${metric.recallAt10.toFixed(4)} | ${metric.precisionAt10.toFixed(4)} | ${metric.f1At10.toFixed(4)} | ${metric.hitGroundTruthFiles.length} | ${metric.missedGroundTruthFiles.length === 0 ? 'None' : metric.missedGroundTruthFiles.join('<br>')} |`,
      );
    }
  }

  lines.push('', '## Warnings', '');
  for (const warning of report.warnings) {
    lines.push(`- ${warning}`);
  }

  return `${lines.join('\n')}\n`;
}

export function normalizeRegistryMethods(
  methods: NormalizedResultMethod[],
): MethodResultFileLike[] {
  return methods.map((method) => ({
    runId: method.sourceFile,
    generatedAt: method.generatedAt,
    method: method.method,
    topK: method.topK,
    sourceFile: method.sourceFile,
    cases: method.cases.map((caseResult) => ({
      caseId: caseResult.caseId,
      repo: caseResult.repo,
      groundTruthFiles: caseResult.groundTruthFiles,
      results: caseResult.rankedResults.map((result) => ({
        filePath: result.filePath,
      })),
    })),
  }));
}

export function computeMetrics(params: {
  cases: EvaluationCase[];
  predictions: BaselinePrediction[];
}): MetricsSummary {
  const predictionByCaseId = new Map(
    params.predictions.map((prediction) => [prediction.caseId, prediction]),
  );

  const methodMetrics = params.cases.map((evaluationCase) =>
    computeCaseMetrics({
      caseId: evaluationCase.id,
      repo: evaluationCase.repo,
      groundTruthFiles: evaluationCase.groundTruth.files,
      retrievedResults: (predictionByCaseId.get(evaluationCase.id)?.rankedFiles ?? []).map(
        (filePath) => ({ filePath }),
      ),
      topKCount: TOP_K_10,
    }),
  );
  const aggregate = aggregateCaseMetrics(methodMetrics);

  return {
    evaluatedCases: params.cases.length,
    precision: aggregate.macroPrecisionAt10,
    recall: aggregate.macroRecallAt10,
    f1: aggregate.macroF1At10,
    recallAt5: aggregate.macroRecallAt5,
    recallAt10: aggregate.macroRecallAt10,
    evidenceCoverage: 0,
    reviewBurden: roundMetric(
      divideSafe(
        params.predictions.reduce((sum, prediction) => sum + prediction.reviewItems, 0),
        params.cases.length,
      ),
    ),
  };
}
