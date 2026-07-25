import {
  evaluateControlledBetaReadiness,
  evaluateSaasEntry,
  type ReadinessEvidence,
} from './controlled-beta-readiness';

const validEvidence: ReadinessEvidence = {
  capabilityMatrix:
    '| Public GitHub repository | STABLE |\n| TypeScript + NestJS extraction | STABLE |\n| Japanese presentation | EXPERIMENTAL |',
  operationsRunbook:
    'The only `STABLE` product path is a public GitHub repository containing TypeScript/NestJS. Never enable dev-login in production. POST /api/v1/system/queues/:queueName/failed/:jobId/retry',
  authDocumentation:
    'email + password Redis-backed rate limiter audit login permission events',
  architectureDecision: 'Status\nAccepted.\napplication backend-runtime boundary',
  productionProfile: 'NODE_ENV: production\nENABLE_DEV_LOGIN: "false"',
  startupDrill:
    'Status: **PASS**\ndatabase, pgvector, queue, and Redis all reported `up`.',
  restoreDrill: 'Status: **PASS**\npgvector extension | present | present',
  incidentRunbook: 'Incident And Rollback\nApplication rollback\nRecovery',
  localizationTest:
    "expect(finalRes.body.locale).toBe('en'); locale: 'vi-VN'",
  publicRepositories: {
    repositories: [
      {
        commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        reviewStatus: 'REVIEWED',
        frameworkDetected: 'nestjs',
      },
      {
        commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        reviewStatus: 'REVIEWED',
        frameworkDetected: 'nestjs',
      },
      {
        commitSha: 'cccccccccccccccccccccccccccccccccccccccc',
        reviewStatus: 'REVIEWED_WITH_LIMITATION',
        frameworkDetected: 'nestjs',
      },
    ],
  },
  analyzerBaseline: {
    thresholds: {
      criticalArtifactRecall: 1,
      evidenceCoverage: 1,
      negativeControlPassRate: 1,
      orphanEvidencedClaims: 0,
    },
  },
};

describe('controlled beta readiness', () => {
  it('passes only when the controlled-beta evidence set is complete', () => {
    const result = evaluateControlledBetaReadiness(validEvidence);

    expect(result.status).toBe('PASS');
    expect(result.checks.every((check) => check.status === 'PASS')).toBe(true);
  });

  it('fails closed when a production safety or review signal is missing', () => {
    const result = evaluateControlledBetaReadiness({
      ...validEvidence,
      productionProfile: 'NODE_ENV: production\nENABLE_DEV_LOGIN: "true"',
      publicRepositories: { repositories: [] },
    });

    expect(result.status).toBe('FAIL');
    expect(result.failures).toEqual(
      expect.arrayContaining(['production-profile', 'external-repository-review']),
    );
  });
});

describe('SaaS entry gate', () => {
  it('opens Phase 5 only for a promoted, provenance-backed comparison', () => {
    expect(
      evaluateSaasEntry({
        decision: 'PROMOTE',
        candidateCaseCount: 3,
        baselineCaseCount: 3,
        improvements: ['analysisTimeReductionRate'],
        regressions: [],
        reasons: [],
        candidateTool: {
          commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
        baselineTool: {
          commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      }).status,
    ).toBe('OPEN');
  });

  it('keeps Phase 5 locked without a positive beta signal', () => {
    const result = evaluateSaasEntry({
      decision: 'DEFER',
      candidateCaseCount: 3,
      baselineCaseCount: 3,
      improvements: [],
      regressions: [],
      reasons: [],
      candidateTool: {
        commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
      baselineTool: {
        commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    });

    expect(result.status).toBe('LOCKED');
    expect(result.reasons).toContain(
      'Product-validation comparison must be PROMOTE.',
    );
  });
});
