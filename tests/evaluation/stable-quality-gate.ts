import {
  computeArtifactPrecision,
  computeArtifactRecall,
  computeEvidenceCoverage,
  computeNegativeControl,
} from './evaluation-scoring';
import type { EvaluationAdapter } from './evaluation-runner';
import type { EvaluationCase } from './evaluation-types';

export interface QualityMetrics {
  criticalArtifactRecall: number;
  artifactPrecision: number;
  evidenceCoverage: number;
  negativeControlPassRate: number;
  orphanEvidencedClaims: number;
}

export interface QualityBaseline {
  version: number;
  suite: string;
  caseCount: number;
  metrics: QualityMetrics;
  thresholds: QualityMetrics;
  regressionTolerance: number;
}

export interface QualityScorecard {
  schemaVersion: 1;
  suite: string;
  generatedAt: string;
  caseCount: number;
  status: 'PASS' | 'FAIL';
  metrics: QualityMetrics;
  thresholds: QualityMetrics;
  baseline: QualityMetrics;
  regressionTolerance: number;
  failures: string[];
  cases: Array<{
    caseId: string;
    recall: number;
    precision: number;
    evidenceCoverage: number;
    negativeControlPassed: boolean;
    missingArtifacts: string[];
    unexpectedArtifacts: string[];
    leakedNegativeArtifacts: string[];
    orphanEvidencedArtifactKeys: string[];
  }>;
}

const LOWER_IS_BETTER = new Set<keyof QualityMetrics>([
  'orphanEvidencedClaims',
]);

export async function runStableQualityGate(params: {
  adapter: EvaluationAdapter;
  cases: EvaluationCase[];
  baseline: QualityBaseline;
  generatedAt?: string;
}): Promise<QualityScorecard> {
  const caseScores: QualityScorecard['cases'] = [];

  for (const evaluationCase of params.cases) {
    const result = await params.adapter.evaluateCase(evaluationCase);
    const recall = computeArtifactRecall(
      evaluationCase.expected.impactedArtifactKeys,
      result.foundImpactedArtifactKeys,
    );
    const precision = computeArtifactPrecision(
      evaluationCase.expected.impactedArtifactKeys,
      result.foundImpactedArtifactKeys,
    );
    const evidenceCoverage = computeEvidenceCoverage(
      evaluationCase.expected.impactedArtifactKeys,
      result.foundImpactedArtifactKeys,
      result.evidenceByArtifactKey,
    );
    const negativeControl = computeNegativeControl(
      evaluationCase.expected.negativeArtifactKeys,
      result.foundImpactedArtifactKeys,
    );
    const orphanEvidencedArtifactKeys =
      result.foundImpactedArtifactKeys.filter(
        (key) => (result.evidenceByArtifactKey[key]?.length ?? 0) === 0,
      );

    caseScores.push({
      caseId: evaluationCase.id,
      recall: recall.score,
      precision: precision.score,
      evidenceCoverage,
      negativeControlPassed: negativeControl.passed,
      missingArtifacts: recall.missing,
      unexpectedArtifacts: precision.unexpected,
      leakedNegativeArtifacts: negativeControl.failedKeys,
      orphanEvidencedArtifactKeys,
    });
  }

  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const metrics: QualityMetrics = {
    criticalArtifactRecall: average(caseScores.map((score) => score.recall)),
    artifactPrecision: average(caseScores.map((score) => score.precision)),
    evidenceCoverage: average(
      caseScores.map((score) => score.evidenceCoverage),
    ),
    negativeControlPassRate: average(
      caseScores.map((score) => Number(score.negativeControlPassed)),
    ),
    orphanEvidencedClaims: caseScores.reduce(
      (sum, score) => sum + score.orphanEvidencedArtifactKeys.length,
      0,
    ),
  };

  const failures: string[] = [];
  if (caseScores.length !== params.baseline.caseCount) {
    failures.push(
      `caseCount ${caseScores.length} does not match baseline ${params.baseline.caseCount}`,
    );
  }
  for (const metric of Object.keys(metrics) as Array<keyof QualityMetrics>) {
    const actual = metrics[metric];
    const threshold = params.baseline.thresholds[metric];
    const baseline = params.baseline.metrics[metric];
    if (LOWER_IS_BETTER.has(metric)) {
      if (actual > threshold) {
        failures.push(`${metric} ${actual} exceeds threshold ${threshold}`);
      }
      if (actual > baseline + params.baseline.regressionTolerance) {
        failures.push(`${metric} regressed from baseline ${baseline}`);
      }
    } else {
      if (actual < threshold) {
        failures.push(`${metric} ${actual} is below threshold ${threshold}`);
      }
      if (actual < baseline - params.baseline.regressionTolerance) {
        failures.push(`${metric} regressed from baseline ${baseline}`);
      }
    }
  }

  return {
    schemaVersion: 1,
    suite: params.baseline.suite,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    caseCount: caseScores.length,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    metrics,
    thresholds: params.baseline.thresholds,
    baseline: params.baseline.metrics,
    regressionTolerance: params.baseline.regressionTolerance,
    failures,
    cases: caseScores,
  };
}
