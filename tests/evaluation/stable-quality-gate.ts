import {
  computeArtifactPrecision,
  computeArtifactRecall,
  computeEvidenceCoverage,
  computeNegativeControl,
} from './evaluation-scoring';
import type { EvaluationAdapter } from './evaluation-runner';
import type { EvaluationCase, RequiredEvidenceAnchor } from './evaluation-types';

export interface QualityMetrics {
  /** Recall of the per-case critical artifact set, on the retrieval net (Layer 1). */
  criticalArtifactRecall: number;
  /** Recall of the full impacted artifact set, on the retrieval net (Layer 1). */
  overallArtifactRecall: number;
  /** Precision of the committed EVIDENCED-claim set (Layer 2). */
  artifactPrecision: number;
  /** Fraction of correctly-found impacted artifacts that carry evidence. */
  evidenceCoverage: number;
  /** Fraction of cases where no negative artifact leaked into the committed set. */
  negativeControlPassRate: number;
  /** Count of committed artifacts with no evidence excerpt (lower is better). */
  orphanEvidencedClaims: number;
}

export interface PerCaseFloors {
  criticalArtifactRecall: number;
  overallArtifactRecall: number;
  artifactPrecision: number;
}

export interface QualityBaseline {
  version: number;
  suite: string;
  caseCount: number;
  metrics: QualityMetrics;
  thresholds: QualityMetrics;
  perCaseFloors: PerCaseFloors;
  regressionTolerance: number;
}

export interface CaseScorecard {
  caseId: string;
  criticalArtifactRecall: number;
  overallArtifactRecall: number;
  artifactPrecision: number;
  evidenceCoverage: number;
  negativeControlPassed: boolean;
  orphanEvidencedArtifactKeys: string[];
  missingCriticalArtifacts: string[];
  missingImpactedArtifacts: string[];
  unexpectedCommittedArtifacts: string[];
  leakedNegativeArtifacts: string[];
  unmetEvidenceAnchors: RequiredEvidenceAnchor[];
  failures: string[];
}

export interface QualityScorecard {
  schemaVersion: 2;
  suite: string;
  generatedAt: string;
  caseCount: number;
  status: 'PASS' | 'FAIL';
  metrics: QualityMetrics;
  thresholds: QualityMetrics;
  perCaseFloors: PerCaseFloors;
  baseline: QualityMetrics;
  regressionTolerance: number;
  failures: string[];
  cases: CaseScorecard[];
}

const LOWER_IS_BETTER = new Set<keyof QualityMetrics>(['orphanEvidencedClaims']);

function scoreCase(
  evaluationCase: EvaluationCase,
  result: {
    foundImpactedArtifactKeys: string[];
    committedArtifactKeys?: string[];
    evidenceByArtifactKey: Record<string, string[]>;
  },
  floors: PerCaseFloors,
): CaseScorecard {
  const expected = evaluationCase.expected;
  // Layer 1 (retrieval net) and Layer 2 (committed / adjudicated). Adapters that
  // do not distinguish them grade both on the same set.
  const layer1 = result.foundImpactedArtifactKeys;
  const layer2 = result.committedArtifactKeys ?? result.foundImpactedArtifactKeys;

  const criticalKeys =
    expected.criticalArtifactKeys && expected.criticalArtifactKeys.length > 0
      ? expected.criticalArtifactKeys
      : expected.impactedArtifactKeys;
  // The precision-expected set is everything we consider genuinely impacted.
  const precisionExpected = Array.from(
    new Set([...expected.impactedArtifactKeys, ...criticalKeys]),
  );

  const criticalRecall = computeArtifactRecall(criticalKeys, layer1);
  const overallRecall = computeArtifactRecall(expected.impactedArtifactKeys, layer1);
  const precision = computeArtifactPrecision(precisionExpected, layer2);
  const evidenceCoverage = computeEvidenceCoverage(
    expected.impactedArtifactKeys,
    layer1,
    result.evidenceByArtifactKey,
  );
  const negativeControl = computeNegativeControl(expected.negativeArtifactKeys, layer2);
  const orphanEvidencedArtifactKeys = layer2.filter(
    (key) => (result.evidenceByArtifactKey[key]?.length ?? 0) === 0,
  );

  const foundForAnchors = new Set([...layer1, ...layer2]);
  const unmetEvidenceAnchors: RequiredEvidenceAnchor[] = [];
  for (const anchor of expected.requiredEvidenceAnchors ?? []) {
    const excerpts = result.evidenceByArtifactKey[anchor.artifactKey] ?? [];
    const artifactPresent = foundForAnchors.has(anchor.artifactKey);
    const containsOk =
      anchor.contains === undefined ||
      excerpts.some((excerpt) => excerpt.includes(anchor.contains as string));
    if (!artifactPresent || excerpts.length === 0 || !containsOk) {
      unmetEvidenceAnchors.push(anchor);
    }
  }

  // Per-case failure floors — averages alone must never hide a broken case.
  const failures: string[] = [];
  if (criticalRecall.score < floors.criticalArtifactRecall) {
    failures.push(
      `criticalArtifactRecall ${criticalRecall.score.toFixed(3)} < ${floors.criticalArtifactRecall} (missing ${criticalRecall.missing.join(', ') || 'none'})`,
    );
  }
  if (overallRecall.score < floors.overallArtifactRecall) {
    failures.push(
      `overallArtifactRecall ${overallRecall.score.toFixed(3)} < ${floors.overallArtifactRecall} (missing ${overallRecall.missing.join(', ') || 'none'})`,
    );
  }
  if (precision.score < floors.artifactPrecision) {
    failures.push(
      `artifactPrecision ${precision.score.toFixed(3)} < ${floors.artifactPrecision} (unexpected committed ${precision.unexpected.join(', ') || 'none'})`,
    );
  }
  if (!negativeControl.passed) {
    failures.push(`negative artifact leaked into committed set: ${negativeControl.failedKeys.join(', ')}`);
  }
  if (orphanEvidencedArtifactKeys.length > 0) {
    failures.push(`orphan committed artifacts without evidence: ${orphanEvidencedArtifactKeys.join(', ')}`);
  }
  if (unmetEvidenceAnchors.length > 0) {
    failures.push(
      `unmet evidence anchors: ${unmetEvidenceAnchors
        .map((a) => `${a.artifactKey}${a.contains ? `~"${a.contains}"` : ''}`)
        .join(', ')}`,
    );
  }

  return {
    caseId: evaluationCase.id,
    criticalArtifactRecall: criticalRecall.score,
    overallArtifactRecall: overallRecall.score,
    artifactPrecision: precision.score,
    evidenceCoverage,
    negativeControlPassed: negativeControl.passed,
    orphanEvidencedArtifactKeys,
    missingCriticalArtifacts: criticalRecall.missing,
    missingImpactedArtifacts: overallRecall.missing,
    unexpectedCommittedArtifacts: precision.unexpected,
    leakedNegativeArtifacts: negativeControl.failedKeys,
    unmetEvidenceAnchors,
    failures: failures.map((f) => `[${evaluationCase.id}] ${f}`),
  };
}

export async function runStableQualityGate(params: {
  adapter: EvaluationAdapter;
  cases: EvaluationCase[];
  baseline: QualityBaseline;
  generatedAt?: string;
}): Promise<QualityScorecard> {
  const caseScores: CaseScorecard[] = [];
  for (const evaluationCase of params.cases) {
    const result = await params.adapter.evaluateCase(evaluationCase);
    caseScores.push(scoreCase(evaluationCase, result, params.baseline.perCaseFloors));
  }

  const average = (values: number[]) =>
    values.length === 0 ? 1 : values.reduce((sum, value) => sum + value, 0) / values.length;

  const metrics: QualityMetrics = {
    criticalArtifactRecall: average(caseScores.map((s) => s.criticalArtifactRecall)),
    overallArtifactRecall: average(caseScores.map((s) => s.overallArtifactRecall)),
    artifactPrecision: average(caseScores.map((s) => s.artifactPrecision)),
    evidenceCoverage: average(caseScores.map((s) => s.evidenceCoverage)),
    negativeControlPassRate: average(caseScores.map((s) => Number(s.negativeControlPassed))),
    orphanEvidencedClaims: caseScores.reduce(
      (sum, s) => sum + s.orphanEvidencedArtifactKeys.length,
      0,
    ),
  };

  const failures: string[] = [];

  // 1. Per-case floor failures.
  for (const score of caseScores) {
    failures.push(...score.failures);
  }

  // 2. Case-count guard.
  if (caseScores.length !== params.baseline.caseCount) {
    failures.push(
      `caseCount ${caseScores.length} does not match baseline ${params.baseline.caseCount}`,
    );
  }

  // 3. Aggregate threshold + regression guards.
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
    schemaVersion: 2,
    suite: params.baseline.suite,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    caseCount: caseScores.length,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    metrics,
    thresholds: params.baseline.thresholds,
    perCaseFloors: params.baseline.perCaseFloors,
    baseline: params.baseline.metrics,
    regressionTolerance: params.baseline.regressionTolerance,
    failures,
    cases: caseScores,
  };
}
