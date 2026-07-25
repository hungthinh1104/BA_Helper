import { z } from 'zod';

interface ExternalRepositoryReview {
  commitSha: string;
  reviewStatus: string;
  frameworkDetected: string;
}

export interface ReadinessEvidence {
  capabilityMatrix: string;
  operationsRunbook: string;
  authDocumentation: string;
  architectureDecision: string;
  productionProfile: string;
  startupDrill: string;
  restoreDrill: string;
  incidentRunbook: string;
  localizationTest: string;
  publicRepositories: { repositories: ExternalRepositoryReview[] };
  analyzerBaseline: {
    thresholds: Record<string, number>;
  };
}

interface ReadinessCheck {
  id: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

function check(id: string, passed: boolean, detail: string): ReadinessCheck {
  return { id, status: passed ? 'PASS' : 'FAIL', detail };
}

export function evaluateControlledBetaReadiness(
  evidence: ReadinessEvidence,
) {
  const repositories = evidence.publicRepositories.repositories;
  const thresholds = evidence.analyzerBaseline.thresholds;
  const checks = [
    check(
      'supported-path',
      evidence.capabilityMatrix.includes(
        '| Public GitHub repository | STABLE |',
      ) &&
        evidence.capabilityMatrix.includes(
          '| TypeScript + NestJS extraction | STABLE |',
        ) &&
        evidence.capabilityMatrix.includes(
          '| Japanese presentation | EXPERIMENTAL |',
        ),
      'Public GitHub NestJS is the stable path and Japanese remains experimental.',
    ),
    check(
      'architecture-boundary',
      evidence.architectureDecision.includes('Accepted.') &&
        evidence.architectureDecision.includes('application') &&
        evidence.architectureDecision.includes('backend-runtime'),
      'Application/runtime ADR is accepted.',
    ),
    check(
      'production-profile',
      evidence.productionProfile.includes('NODE_ENV: production') &&
        evidence.productionProfile.includes('ENABLE_DEV_LOGIN: "false"') &&
        !evidence.productionProfile.includes('ENABLE_DEV_LOGIN: "true"'),
      'Production profile disables dev login.',
    ),
    check(
      'production-startup',
      evidence.startupDrill.includes('Status: **PASS**') &&
        ['database', 'pgvector', 'queue', 'Redis'].every((dependency) =>
          evidence.startupDrill.includes(dependency),
        ),
      'Production API, worker, web, and dependencies passed startup verification.',
    ),
    check(
      'restore-drill',
      evidence.restoreDrill.includes('Status: **PASS**') &&
        evidence.restoreDrill.includes('pgvector'),
      'Backup restore was exercised against a temporary database.',
    ),
    check(
      'operations-recovery',
      evidence.operationsRunbook.includes(
        'Never enable dev-login in production',
      ) &&
        evidence.operationsRunbook.includes(
          '/queues/:queueName/failed/:jobId/retry',
        ) &&
        evidence.incidentRunbook.includes('Application rollback'),
      'Operator, retry, incident, and rollback paths are documented.',
    ),
    check(
      'auth-hardening',
      ['email + password', 'Redis-backed', 'audit'].every((term) =>
        evidence.authDocumentation.includes(term),
      ),
      'Local password auth, distributed throttling, and audit are documented.',
    ),
    check(
      'analyzer-quality',
      thresholds.criticalArtifactRecall === 1 &&
        thresholds.evidenceCoverage === 1 &&
        thresholds.negativeControlPassRate === 1 &&
        thresholds.orphanEvidencedClaims === 0,
      'Critical recall, evidence, negative controls, and orphan claims are gated.',
    ),
    check(
      'external-repository-review',
      repositories.length >= 3 &&
        repositories.length <= 5 &&
        repositories.every(
          (repository) =>
            /^[a-f0-9]{40}$/i.test(repository.commitSha) &&
            repository.frameworkDetected === 'nestjs' &&
            ['REVIEWED', 'REVIEWED_WITH_LIMITATION'].includes(
              repository.reviewStatus,
            ),
        ),
      'Three to five pinned public NestJS repositories have review evidence.',
    ),
    check(
      'en-vi-report',
      evidence.localizationTest.includes("locale).toBe('en')") &&
        evidence.localizationTest.includes("locale: 'vi-VN'"),
      'English and Vietnamese final report paths have E2E coverage.',
    ),
  ];
  const failures = checks
    .filter((item) => item.status === 'FAIL')
    .map((item) => item.id);

  return {
    status: failures.length === 0 ? ('PASS' as const) : ('FAIL' as const),
    checks,
    failures,
  };
}

const saasComparisonSchema = z.object({
  decision: z.enum(['PROMOTE', 'DEFER', 'INCONCLUSIVE']),
  candidateCaseCount: z.number().int().min(0),
  baselineCaseCount: z.number().int().min(0),
  improvements: z.array(z.string()),
  regressions: z.array(z.string()),
  reasons: z.array(z.string()),
  candidateTool: z.object({ commitSha: z.string().regex(/^[a-f0-9]{40}$/i) }),
  baselineTool: z.object({ commitSha: z.string().regex(/^[a-f0-9]{40}$/i) }),
});

export function evaluateSaasEntry(input: unknown) {
  const comparison = saasComparisonSchema.parse(input);
  const reasons: string[] = [];

  if (comparison.decision !== 'PROMOTE') {
    reasons.push('Product-validation comparison must be PROMOTE.');
  }
  if (
    comparison.candidateCaseCount < 3 ||
    comparison.baselineCaseCount < 3
  ) {
    reasons.push('Candidate and baseline each require at least three cases.');
  }
  if (comparison.improvements.length === 0) {
    reasons.push('At least one product metric must improve.');
  }
  if (comparison.regressions.length > 0) {
    reasons.push('Product metric regressions must be empty.');
  }
  if (
    comparison.candidateTool.commitSha === comparison.baselineTool.commitSha
  ) {
    reasons.push('Candidate and baseline tool commits must differ.');
  }

  return {
    status: reasons.length === 0 ? ('OPEN' as const) : ('LOCKED' as const),
    reasons,
    comparison,
  };
}
