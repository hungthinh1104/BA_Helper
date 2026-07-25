import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LexicalRetrievalEvaluationAdapter } from './adapters/lexical-retrieval.adapter';
import { bookingStableEvaluationCases } from './cases';
import {
  runStableQualityGate,
  type QualityBaseline,
} from './stable-quality-gate';

const baseline = JSON.parse(
  readFileSync(
    path.join(process.cwd(), 'tests/evaluation/quality-baseline.json'),
    'utf8',
  ),
) as QualityBaseline;

describe('Stable analyzer quality gate', () => {
  it('blocks recall, evidence, negative-control, orphan, and precision regressions', async () => {
    const scorecard = await runStableQualityGate({
      adapter: new LexicalRetrievalEvaluationAdapter(),
      cases: bookingStableEvaluationCases,
      baseline,
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(scorecard.status).toBe('PASS');
    expect(scorecard.caseCount).toBe(5);
    expect(scorecard.metrics).toMatchObject({
      criticalArtifactRecall: 1,
      evidenceCoverage: 1,
      negativeControlPassRate: 1,
      orphanEvidencedClaims: 0,
    });
    expect(scorecard.metrics.artifactPrecision).toBeGreaterThanOrEqual(0.4);
    expect(scorecard.failures).toEqual([]);
  });

  it('fails when a metric regresses beyond tolerance', async () => {
    const scorecard = await runStableQualityGate({
      adapter: new LexicalRetrievalEvaluationAdapter(),
      cases: bookingStableEvaluationCases,
      baseline: {
        ...baseline,
        metrics: { ...baseline.metrics, artifactPrecision: 0.9 },
      },
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(scorecard.status).toBe('FAIL');
    expect(scorecard.failures).toContain(
      'artifactPrecision regressed from baseline 0.9',
    );
  });
});
