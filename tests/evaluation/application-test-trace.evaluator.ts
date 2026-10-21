import { readFileSync } from 'node:fs';
import path from 'node:path';
import { evaluateTestTraceCorpus } from './public-test-trace.evaluator';

type Measurement = ReturnType<typeof evaluateTestTraceCorpus>;
type ScoreKind = keyof Measurement['totals'];
export type TraceRegressionPolicy = {
  groundTruthSha256: string;
  expected: Record<ScoreKind, number>;
  allowedMissing: Record<ScoreKind, string[]>;
};

/** A regression pass does not turn known accuracy gaps into successful extraction. */
export function checkTraceRegression(result: Pick<Measurement, 'groundTruthSha256' | 'totals' | 'evidence' | 'identityAmbiguities'>, policy: TraceRegressionPolicy) {
  const violations: string[] = [];
  if (result.groundTruthSha256 !== policy.groundTruthSha256) violations.push('GROUND_TRUTH_CHANGED');
  if (result.evidence.issues.length) violations.push('SOURCE_EVIDENCE_INTEGRITY_FAILURE');
  if (result.identityAmbiguities.length) violations.push('AMBIGUOUS_SYMBOL_IDENTITY');
  for (const kind of ['cases', 'calls', 'tests'] as const) {
    const score = result.totals[kind];
    if (score.expected !== policy.expected[kind]) violations.push(`${kind}:EXPECTED_UNIVERSE_CHANGED`);
    if (score.unexpected.length) violations.push(`${kind}:UNEXPECTED_REFERENCES`);
    if (score.missing.some(value => !policy.allowedMissing[kind].includes(value))) violations.push(`${kind}:NEW_MISSES`);
  }
  return { status: violations.length ? 'FAIL' as const : 'PASS' as const, violations };
}

export function evaluateApplicationTestTraces(root = process.cwd()) {
  const result = evaluateTestTraceCorpus(root, 'application-test-trace.ground-truth.json');
  const policy = JSON.parse(readFileSync(path.join(root, 'tests/evaluation/application-test-trace.regression.json'), 'utf8')) as TraceRegressionPolicy;
  return { ...result, regression: checkTraceRegression(result, policy) };
}
