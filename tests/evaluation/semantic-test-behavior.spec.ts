import { evaluateSemanticTestBehavior } from './semantic-test-behavior.evaluator';

describe('held-out static Jest behavior evaluation', () => {
  it('scores frozen source labels, exact provenance, and explicit unsupported patterns', () => {
    const result = evaluateSemanticTestBehavior();

    expect(result.status).toBe('PASS');
    expect(result.regression).toEqual({ status: 'PASS', violations: [] });
    expect(result.behaviorClaims).toMatchObject({
      expected: 19, predicted: 19, truePositive: 19, falsePositive: 0, falseNegative: 0,
      precision: 1, recall: 1, f1: 1,
    });
    expect(result.provenance).toMatchObject({ checkedClaims: 19, supportedClaims: 19, integrityRate: 1, issues: [] });
    expect(result.unsupportedPatterns).toMatchObject({
      expected: 3, predicted: 3, truePositive: 3, falsePositive: 0, falseNegative: 0,
      precision: 1, recall: 1,
      observedPatterns: [
        { pattern: 'DYNAMIC_MATCHER_NOT_ANALYZED', filePath: 'test/refund.service.test.ts', line: 28, column: 5, count: 1 },
        { pattern: 'NESTED_CALLBACK_NOT_ANALYZED', filePath: 'test/refund.service.test.ts', line: 27, column: 16, count: 1 },
        { pattern: 'SNAPSHOT_EXPECTATION_UNRESOLVED', filePath: 'test/refund.service.test.ts', line: 29, column: 5, count: 1 },
      ],
      provenanceIssues: [],
    });
    expect(result.groundTruth).toMatchObject({
      independentHumanReview: false,
      labelReviewStatus: 'PENDING_SECOND_REVIEW',
      commitContextKind: 'CONTENT_DERIVED_FIXTURE_SNAPSHOT_ID',
    });
    expect(result.leakage).toEqual([]);
  });

  it('reports runtime-independent latency and memory observations without turning them into accuracy claims', () => {
    const result = evaluateSemanticTestBehavior();
    expect(result.performance.scanMs).toBeGreaterThanOrEqual(0);
    expect(result.performance.memoryBeforeBytes.rss).toBeGreaterThan(0);
    expect(result.performance.memoryAfterBytes.heapUsed).toBeGreaterThan(0);
    expect(result.groundTruth.limitations).toContain(
      'No runtime test execution, coverage, pass/fail, or business-rule correctness is measured.',
    );
  });
});
