import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DomainPackRegistry } from '@ba-helper/backend-runtime';
import {
  bookingStableEvaluationCases,
  ecommercePartialEvaluationCases,
  generalFallbackEvaluationCases,
  healthcarePartialEvaluationCases,
  rentalPartialEvaluationCases,
} from './cases';
import { EvaluationCase, evaluationCaseSchema } from './evaluation-types';

type DomainEvaluationSet = {
  packId: string;
  cases: EvaluationCase[];
  invariantSpecPath?: string;
};

type DomainEvaluationSummary = {
  packId: string;
  canonicalId: string;
  status: string;
  requiresExplicitSelection: boolean;
  evaluationCaseCount: number;
  sourceEvidenceInvariantCovered: boolean;
};

const MIN_PARTIAL_CASES = 3;

const DOMAIN_EVALUATION_SETS: DomainEvaluationSet[] = [
  {
    packId: 'booking',
    cases: bookingStableEvaluationCases,
    invariantSpecPath: 'tests/evaluation/booking-domain-stable.spec.ts',
  },
  {
    packId: 'ecommerce',
    cases: ecommercePartialEvaluationCases,
    invariantSpecPath: 'tests/evaluation/ecommerce-domain-partial.spec.ts',
  },
  {
    packId: 'general',
    cases: generalFallbackEvaluationCases,
    invariantSpecPath: 'tests/evaluation/general-domain-fallback.spec.ts',
  },
  {
    packId: 'healthcare',
    cases: healthcarePartialEvaluationCases,
    invariantSpecPath: 'tests/evaluation/healthcare-domain-partial.spec.ts',
  },
  {
    packId: 'rental',
    cases: rentalPartialEvaluationCases,
    invariantSpecPath: 'tests/evaluation/rental-domain-partial.spec.ts',
  },
];

describe('cross-domain evaluation summary', () => {
  let registry: DomainPackRegistry;

  beforeEach(() => {
    registry = new DomainPackRegistry();
  });

  it('aggregates evaluation coverage count and capability status per domain pack', () => {
    const summary = buildDomainEvaluationSummary(registry, DOMAIN_EVALUATION_SETS);

    expect(summary).toEqual([
      {
        packId: 'booking',
        canonicalId: 'booking@0.1.0',
        status: 'STABLE',
        requiresExplicitSelection: false,
        evaluationCaseCount: 5,
        sourceEvidenceInvariantCovered: true,
      },
      {
        packId: 'ecommerce',
        canonicalId: 'ecommerce@0.1.0',
        status: 'PARTIAL',
        requiresExplicitSelection: true,
        evaluationCaseCount: 3,
        sourceEvidenceInvariantCovered: true,
      },
      {
        packId: 'general',
        canonicalId: 'general@0.0.0',
        status: 'FALLBACK',
        requiresExplicitSelection: false,
        evaluationCaseCount: 4,
        sourceEvidenceInvariantCovered: true,
      },
      {
        packId: 'healthcare',
        canonicalId: 'healthcare@0.1.0',
        status: 'PARTIAL',
        requiresExplicitSelection: true,
        evaluationCaseCount: 3,
        sourceEvidenceInvariantCovered: true,
      },
      {
        packId: 'rental',
        canonicalId: 'rental@0.1.0',
        status: 'PARTIAL',
        requiresExplicitSelection: true,
        evaluationCaseCount: 3,
        sourceEvidenceInvariantCovered: true,
      },
    ]);
  });

  it('requires every PARTIAL domain pack to have minimum evaluation coverage', () => {
    const summary = buildDomainEvaluationSummary(registry, DOMAIN_EVALUATION_SETS);
    const partialProfiles = summary.filter((item) => item.status === 'PARTIAL');

    expect(partialProfiles.map((item) => item.packId).sort()).toEqual([
      'ecommerce',
      'healthcare',
      'rental',
    ]);

    for (const profile of partialProfiles) {
      expect(profile.evaluationCaseCount).toBeGreaterThanOrEqual(MIN_PARTIAL_CASES);
    }
  });

  it('requires every explicit-select domain to have source-evidence invariant tests', () => {
    const summary = buildDomainEvaluationSummary(registry, DOMAIN_EVALUATION_SETS);
    const explicitProfiles = summary.filter((item) => item.requiresExplicitSelection);

    expect(explicitProfiles.map((item) => item.packId).sort()).toEqual([
      'ecommerce',
      'healthcare',
      'rental',
    ]);

    for (const profile of explicitProfiles) {
      expect(profile.sourceEvidenceInvariantCovered).toBe(true);
    }
  });

  it('keeps domain evaluation cases schema-valid and source-evidence shaped', () => {
    for (const evaluationSet of DOMAIN_EVALUATION_SETS) {
      for (const evalCase of evaluationSet.cases) {
        expect(() => evaluationCaseSchema.parse(evalCase)).not.toThrow();
        expect(evalCase.domain?.packId).toBe(evaluationSet.packId);
        expect(evalCase.expected.impactedArtifactKeys.length).toBeGreaterThan(0);
        expect(evalCase.expected.evidenceHints?.length ?? 0).toBeGreaterThan(0);

        for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
          expect(artifactKey).not.toMatch(/^domain-pack:/);
        }
      }
    }
  });
});

function buildDomainEvaluationSummary(
  registry: DomainPackRegistry,
  evaluationSets: DomainEvaluationSet[],
): DomainEvaluationSummary[] {
  const casesByPackId = new Map(evaluationSets.map((item) => [item.packId, item]));

  return registry.listProfiles().map((profile) => {
    const evaluationSet = casesByPackId.get(profile.id);
    return {
      packId: profile.id,
      canonicalId: profile.canonicalId,
      status: profile.status,
      requiresExplicitSelection: profile.requiresExplicitSelection,
      evaluationCaseCount: evaluationSet?.cases.length ?? 0,
      sourceEvidenceInvariantCovered: evaluationSet
        ? hasSourceEvidenceInvariantSpec(evaluationSet)
        : false,
    };
  });
}

function hasSourceEvidenceInvariantSpec(evaluationSet: DomainEvaluationSet): boolean {
  if (!evaluationSet.invariantSpecPath) {
    return false;
  }

  const specPath = resolve(process.cwd(), evaluationSet.invariantSpecPath);
  const specSource = readFileSync(specPath, 'utf-8');
  const hasSourceEvidenceAssertion = /requires (?:raw )?source(?:-code)? (?:evidence|excerpts)/.test(specSource);
  const hasTemplateEvidenceGuard = /(?:hints|templates).*out of evidence/.test(specSource) ||
    /not\.toMatch\(\^?\/\^domain-pack:/.test(specSource);

  return hasSourceEvidenceAssertion && hasTemplateEvidenceGuard;
}
