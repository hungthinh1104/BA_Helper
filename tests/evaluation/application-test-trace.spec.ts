import { readFileSync } from 'node:fs';
import path from 'node:path';
import { checkTraceRegression, evaluateApplicationTestTraces } from './application-test-trace.evaluator';
import type { TraceRegressionPolicy } from './application-test-trace.evaluator';
import { scoreReferenceSet } from './public-test-trace.evaluator';

describe('application source static trace accuracy', () => {
  const policy = JSON.parse(readFileSync(path.resolve('tests/evaluation/application-test-trace.regression.json'), 'utf8')) as TraceRegressionPolicy;

  it('preserves source pins and finds every labeled declaration and relationship', () => {
    const result = evaluateApplicationTestTraces();
    expect(result.repositories.map(repo => repo.id)).toEqual(['amplication-billing', 'novu-subscribers']);
    expect(result.totals.cases).toMatchObject({ expected: 27, truePositive: 27, falsePositive: 0, falseNegative: 0 });
    expect(result.totals.calls).toMatchObject({ expected: 22, truePositive: 22, falsePositive: 0, falseNegative: 0 });
    expect(result.totals.tests).toMatchObject({ expected: 28, truePositive: 28, falsePositive: 0, falseNegative: 0 });
    expect(result.totals.tests.f1).toBe(1);
    expect(result.evidence.integrityRate).toBe(1);
    expect(result.evidence.issues).toEqual([]);
    expect(result.identityAmbiguities).toEqual([]);
    expect(result.totals.cases.missing).toEqual(policy.allowedMissing.cases);
    expect(result.totals.tests.missing).toEqual(policy.allowedMissing.tests);
    expect(result.repositories[0].diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'JEST_UNSUPPORTED_DECLARATION' }),
    ]));
    expect(result.status).toBe('PASS');
    expect(result.regression).toEqual({ status: 'PASS', violations: [] });
    expect(result.independentHumanReview).toBe(false);
  });

  function measured(): Pick<ReturnType<typeof evaluateApplicationTestTraces>, 'groundTruthSha256' | 'totals' | 'evidence' | 'identityAmbiguities'> {
    return { groundTruthSha256: 'pinned', totals: {
      cases: scoreReferenceSet(['case'], ['case']), calls: scoreReferenceSet(['call'], ['call']),
      tests: scoreReferenceSet(['known-gap', 'test'], ['test']),
    }, evidence: { checkedRelationships: 1, supportedRelationships: 1, integrityRate: 1, issues: [] }, identityAmbiguities: [] };
  }
  const smallPolicy: TraceRegressionPolicy = { groundTruthSha256: 'pinned', expected: { cases: 1, calls: 1, tests: 2 },
    allowedMissing: { cases: [], calls: [], tests: ['known-gap'] } };

  it('allows only the explicitly recorded gap and accepts future improvement', () => {
    expect(checkTraceRegression(measured(), smallPolicy).status).toBe('PASS');
    const improved = measured();
    improved.totals.tests = scoreReferenceSet(['known-gap', 'test'], ['known-gap', 'test']);
    expect(checkTraceRegression(improved, smallPolicy).status).toBe('PASS');
  });

  it('rejects symbol-only scoring when a graded method name resolves to multiple files', () => {
    const result = measured();
    result.identityAmbiguities = [{ repositoryId: 'example', symbolName: 'BillingService.refund',
      candidateFiles: ['src/a.ts', 'src/b.ts'] }];
    expect(checkTraceRegression(result, smallPolicy)).toEqual({
      status: 'FAIL', violations: ['AMBIGUOUS_SYMBOL_IDENTITY'],
    });
  });

  it('rejects new misses, false positives, changed labels and smaller expected universes', () => {
    const result = measured();
    result.groundTruthSha256 = 'edited';
    result.evidence.issues.push({ repositoryId: 'example', edge: 'bad', reason: 'MISSING_LOCATION' });
    result.totals.cases = scoreReferenceSet([], []);
    result.totals.calls = scoreReferenceSet(['call'], ['noise']);
    result.totals.tests = scoreReferenceSet(['known-gap', 'test'], []);
    expect(checkTraceRegression(result, smallPolicy)).toEqual({ status: 'FAIL', violations: [
      'GROUND_TRUTH_CHANGED', 'SOURCE_EVIDENCE_INTEGRITY_FAILURE', 'cases:EXPECTED_UNIVERSE_CHANGED',
      'calls:UNEXPECTED_REFERENCES', 'calls:NEW_MISSES', 'tests:NEW_MISSES',
    ] });
  });
});
