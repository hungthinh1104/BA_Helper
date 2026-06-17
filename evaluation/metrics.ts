import type {
  BaselinePrediction,
  EvaluationCase,
  MetricsSummary,
} from './types';

function divideSafe(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

export function computeMetrics(params: {
  cases: EvaluationCase[];
  predictions: BaselinePrediction[];
}): MetricsSummary {
  const predictionByCaseId = new Map(
    params.predictions.map((prediction) => [prediction.caseId, prediction]),
  );

  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let recallAt5Hits = 0;
  let recallAt10Hits = 0;
  let evidenceBackedPredictedFiles = 0;
  let totalPredictedFiles = 0;
  let totalReviewItems = 0;

  for (const evaluationCase of params.cases) {
    const prediction = predictionByCaseId.get(evaluationCase.id);
    const groundTruthFiles = new Set(evaluationCase.groundTruth.files);
    const predictedFiles = new Set(prediction?.predictedFiles ?? []);

    totalReviewItems += prediction?.reviewItems ?? 0;
    totalPredictedFiles += predictedFiles.size;
    evidenceBackedPredictedFiles +=
      prediction?.evidenceBackedPredictedFiles.length ?? 0;

    for (const file of predictedFiles) {
      if (groundTruthFiles.has(file)) {
        truePositive += 1;
      } else {
        falsePositive += 1;
      }
    }

    for (const file of groundTruthFiles) {
      if (!predictedFiles.has(file)) {
        falseNegative += 1;
      }
    }

    const rankedTop5 = new Set((prediction?.rankedFiles ?? []).slice(0, 5));
    const rankedTop10 = new Set((prediction?.rankedFiles ?? []).slice(0, 10));

    if ([...groundTruthFiles].some((file) => rankedTop5.has(file))) {
      recallAt5Hits += 1;
    }

    if ([...groundTruthFiles].some((file) => rankedTop10.has(file))) {
      recallAt10Hits += 1;
    }
  }

  const precision = divideSafe(truePositive, truePositive + falsePositive);
  const recall = divideSafe(truePositive, truePositive + falseNegative);
  const f1 = divideSafe(2 * precision * recall, precision + recall);

  return {
    evaluatedCases: params.cases.length,
    precision: roundMetric(precision),
    recall: roundMetric(recall),
    f1: roundMetric(f1),
    recallAt5: roundMetric(divideSafe(recallAt5Hits, params.cases.length)),
    recallAt10: roundMetric(divideSafe(recallAt10Hits, params.cases.length)),
    evidenceCoverage: roundMetric(
      divideSafe(evidenceBackedPredictedFiles, totalPredictedFiles),
    ),
    reviewBurden: roundMetric(divideSafe(totalReviewItems, params.cases.length)),
  };
}
