import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DomainPackRegistry } from '../../apps/api/src/modules/domain-pack/application/domain-pack.registry';
import { BookingDomainPack } from '../../apps/api/src/modules/domain-pack/packs/booking.v0.1.0';
import { evaluationCaseSchema } from './evaluation-types';
import { bookingStableEvaluationCases } from './cases';

type FixtureArtifact = {
  stableId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  excerpt: string;
};

const fixtureArtifacts = (): Map<string, FixtureArtifact> => {
  const expectedArtifactsPath = resolve(
    __dirname,
    '../fixtures/nestjs-booking-with-payment/expected/artifacts.json',
  );
  const parsed = JSON.parse(readFileSync(expectedArtifactsPath, 'utf-8')) as {
    artifacts: FixtureArtifact[];
  };

  return new Map(parsed.artifacts.map((artifact) => [artifact.stableId, artifact]));
};

describe('Booking domain STABLE evaluation cases', () => {
  let registry: DomainPackRegistry;
  let artifactsByKey: Map<string, FixtureArtifact>;

  beforeEach(() => {
    registry = new DomainPackRegistry();
    artifactsByKey = fixtureArtifacts();
  });

  it('declares booking@0.1.0 as the explicit STABLE evaluation target', () => {
    const selection = registry.selectPack({ manualPackId: 'booking@0.1.0' });

    expect(selection.normalizedPackId).toBe('booking');
    expect(selection.pack.version).toBe('0.1.0');
    expect(selection.pack.status).toBe('STABLE');
    expect(bookingStableEvaluationCases.length).toBe(5);
  });

  it('keeps all booking stable cases schema-valid with expected outcomes', () => {
    for (const evalCase of bookingStableEvaluationCases) {
      expect(() => evaluationCaseSchema.parse(evalCase)).not.toThrow();
      expect(evalCase.domain?.packId).toBe('booking');
      expect(evalCase.expected.impactedArtifactKeys.length).toBeGreaterThan(0);
      expect(evalCase.expected.unknownsOrQuestions?.length).toBeGreaterThan(0);
      expect(evalCase.expected.risks?.length).toBeGreaterThan(0);
      expect(evalCase.expected.qaScenarios?.length).toBeGreaterThan(0);
    }
  });

  it('covers cancellation, refund, double refund, inventory release, and payment state', () => {
    const corpus = bookingStableEvaluationCases
      .map((evalCase) => [
        evalCase.id,
        evalCase.requirementTitle,
        evalCase.requirementText,
        ...(evalCase.expected.unknownsOrQuestions ?? []),
        ...(evalCase.expected.risks ?? []),
        ...(evalCase.expected.qaScenarios ?? []),
      ].join(' '))
      .join(' ')
      .toLowerCase();

    for (const term of ['cancellation', 'refund', 'double refund', 'inventory release', 'payment state']) {
      expect(corpus).toContain(term);
    }
  });

  it('maps expected domain concepts through the registry glossary only', () => {
    for (const evalCase of bookingStableEvaluationCases) {
      const expectedConceptKeys = evalCase.domain?.expectedConceptKeys ?? [];
      const matchedConcepts = registry.matchConcepts(
        `${evalCase.requirementTitle} ${evalCase.requirementText}`,
        BookingDomainPack,
      );

      expect(matchedConcepts).toEqual(expect.arrayContaining(expectedConceptKeys));
    }
  });

  it('requires source-code evidence for every expected impacted artifact', () => {
    for (const evalCase of bookingStableEvaluationCases) {
      for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
        const artifact = artifactsByKey.get(artifactKey);

        expect(artifact).toBeDefined();
        expect(artifact?.filePath).toMatch(/^src\//);
        expect(artifact?.startLine).toBeGreaterThan(0);
        expect(artifact?.endLine).toBeGreaterThanOrEqual(artifact?.startLine ?? 0);
        expect(artifact?.excerpt.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps domain-pack hints out of evidence and impacted artifact keys', () => {
    const domainPackTemplates = [
      ...BookingDomainPack.retrievalHints,
      ...BookingDomainPack.riskTemplates,
      ...BookingDomainPack.qaTemplates,
      ...BookingDomainPack.unknownTemplates,
    ];

    for (const evalCase of bookingStableEvaluationCases) {
      for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
        const artifact = artifactsByKey.get(artifactKey);

        expect(artifactKey).not.toMatch(/^domain-pack:/);
        expect(artifact?.filePath).not.toContain('domain-pack');
        expect(domainPackTemplates).not.toContain(artifact?.excerpt);
      }
    }
  });

  it('keeps policy hints as unknowns instead of fabricated evidence', () => {
    const policyCase = bookingStableEvaluationCases.find(
      (evalCase) => evalCase.id === 'booking-stable-policy-hints-stay-unknown',
    );

    expect(policyCase).toBeDefined();
    expect(policyCase?.expected.unknownsOrQuestions).toEqual(
      expect.arrayContaining(['refund deadline', 'refund amount', 'owner approval']),
    );
    expect(policyCase?.expected.impactedArtifactKeys).not.toEqual(
      expect.arrayContaining(['domain-pack:refund-deadline', 'domain-pack:owner-approval']),
    );
  });

  it('treats admin refund report as deterministic keyword noise', () => {
    for (const evalCase of bookingStableEvaluationCases) {
      expect(artifactsByKey.has('service-method:refund-report.service.generateReport')).toBe(true);
      expect(evalCase.expected.negativeArtifactKeys).toContain(
        'service-method:refund-report.service.generateReport',
      );
      expect(evalCase.expected.impactedArtifactKeys).not.toContain(
        'service-method:refund-report.service.generateReport',
      );
    }
  });
});
