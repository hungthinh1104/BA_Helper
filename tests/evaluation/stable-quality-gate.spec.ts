import type { EvaluationAdapter } from './evaluation-runner';
import type { EvaluationCase, NormalizedEvaluationResult } from './evaluation-types';
import { runStableQualityGate, type QualityBaseline } from './stable-quality-gate';

const baseline: QualityBaseline = {
  version: 2,
  suite: 'unit',
  caseCount: 1,
  metrics: {
    criticalArtifactRecall: 1,
    overallArtifactRecall: 1,
    artifactPrecision: 1,
    evidenceCoverage: 1,
    negativeControlPassRate: 1,
    orphanEvidencedClaims: 0,
  },
  thresholds: {
    criticalArtifactRecall: 1,
    overallArtifactRecall: 0.85,
    artifactPrecision: 0.7,
    evidenceCoverage: 1,
    negativeControlPassRate: 1,
    orphanEvidencedClaims: 0,
  },
  perCaseFloors: {
    criticalArtifactRecall: 1,
    overallArtifactRecall: 0.8,
    artifactPrecision: 0.7,
  },
  regressionTolerance: 0.05,
};

const evalCase: EvaluationCase = {
  id: 'unit-case',
  requirementTitle: 'Cancel refund',
  requirementText: 'Cancel a paid booking and refund.',
  targetFixture: 'fixture',
  expected: {
    criticalArtifactKeys: ['api:cancel', 'service:refund'],
    impactedArtifactKeys: ['api:cancel', 'service:refund', 'entity:payment'],
    negativeArtifactKeys: ['service:report'],
    requiredEvidenceAnchors: [{ artifactKey: 'service:refund', contains: 'REFUNDED' }],
  },
};

class StubAdapter implements EvaluationAdapter {
  constructor(private readonly result: NormalizedEvaluationResult) {}
  async evaluateCase(): Promise<NormalizedEvaluationResult> {
    return this.result;
  }
}

const perfectResult: NormalizedEvaluationResult = {
  // Layer 1 (recall net) legitimately includes the decoy — that is fine.
  foundImpactedArtifactKeys: ['api:cancel', 'service:refund', 'entity:payment', 'service:report'],
  // Layer 2 (committed) is precise and excludes the decoy.
  committedArtifactKeys: ['api:cancel', 'service:refund'],
  evidenceByArtifactKey: {
    'api:cancel': ['@Post cancel()'],
    'service:refund': ['status = REFUNDED'],
    'entity:payment': ['class Payment'],
    'service:report': ['generateReport()'],
  },
  unknownsOrQuestions: [],
  risks: [],
  qaScenarios: [],
};

const run = (result: NormalizedEvaluationResult) =>
  runStableQualityGate({
    adapter: new StubAdapter(result),
    cases: [evalCase],
    baseline,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });

describe('two-layer stable quality gate scorer', () => {
  it('passes when both layers meet the floors', async () => {
    const scorecard = await run(perfectResult);
    expect(scorecard.status).toBe('PASS');
    expect(scorecard.metrics).toEqual({
      criticalArtifactRecall: 1,
      overallArtifactRecall: 1,
      artifactPrecision: 1,
      evidenceCoverage: 1,
      negativeControlPassRate: 1,
      orphanEvidencedClaims: 0,
    });
    expect(scorecard.failures).toEqual([]);
  });

  it('fails per-case when the committed layer leaks a negative artifact', async () => {
    const scorecard = await run({
      ...perfectResult,
      committedArtifactKeys: ['api:cancel', 'service:refund', 'service:report'],
    });
    expect(scorecard.status).toBe('FAIL');
    expect(scorecard.metrics.negativeControlPassRate).toBe(0);
    expect(scorecard.failures.some((f) => f.includes('negative artifact leaked'))).toBe(true);
  });

  it('fails per-case when a critical artifact is missing (average would hide it)', async () => {
    const scorecard = await run({
      ...perfectResult,
      foundImpactedArtifactKeys: ['api:cancel', 'entity:payment'],
      committedArtifactKeys: ['api:cancel'],
    });
    expect(scorecard.status).toBe('FAIL');
    expect(scorecard.failures.some((f) => f.includes('criticalArtifactRecall'))).toBe(true);
  });

  it('fails when the committed layer commits an out-of-scope artifact (precision)', async () => {
    const scorecard = await run({
      ...perfectResult,
      committedArtifactKeys: ['api:cancel', 'service:refund', 'service:unrelated'],
      evidenceByArtifactKey: {
        ...perfectResult.evidenceByArtifactKey,
        'service:unrelated': ['something'],
      },
    });
    expect(scorecard.status).toBe('FAIL');
    expect(scorecard.failures.some((f) => f.includes('artifactPrecision'))).toBe(true);
  });

  it('fails on orphan committed artifacts without evidence', async () => {
    const scorecard = await run({
      ...perfectResult,
      committedArtifactKeys: ['api:cancel', 'service:refund'],
      evidenceByArtifactKey: {
        'api:cancel': ['@Post cancel()'],
        'service:refund': [],
      },
    });
    expect(scorecard.status).toBe('FAIL');
    expect(scorecard.failures.some((f) => f.includes('orphan'))).toBe(true);
  });

  it('fails when a required evidence anchor substring is absent', async () => {
    const scorecard = await run({
      ...perfectResult,
      evidenceByArtifactKey: {
        ...perfectResult.evidenceByArtifactKey,
        'service:refund': ['status = PAID'],
      },
    });
    expect(scorecard.status).toBe('FAIL');
    expect(scorecard.failures.some((f) => f.includes('evidence anchor'))).toBe(true);
  });

  it('defaults criticalArtifactKeys to the impacted set for legacy cases', async () => {
    const legacyCase: EvaluationCase = {
      ...evalCase,
      expected: {
        impactedArtifactKeys: ['api:cancel', 'service:refund'],
        negativeArtifactKeys: [],
      },
    };
    const scorecard = await runStableQualityGate({
      adapter: new StubAdapter({
        foundImpactedArtifactKeys: ['api:cancel'],
        committedArtifactKeys: ['api:cancel'],
        evidenceByArtifactKey: { 'api:cancel': ['x'] },
        unknownsOrQuestions: [],
        risks: [],
        qaScenarios: [],
      }),
      cases: [legacyCase],
      baseline,
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    // Missing service:refund -> critical recall 0.5 < 1 floor.
    expect(scorecard.status).toBe('FAIL');
    expect(scorecard.failures.some((f) => f.includes('criticalArtifactRecall'))).toBe(true);
  });
});
