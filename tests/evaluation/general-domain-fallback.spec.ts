import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { domainPackAppliedDiagnosticPayloadSchema } from '@ba-helper/contracts';
import { DomainPackRegistry } from '@ba-helper/backend-runtime';
import { BookingDomainPack } from '@ba-helper/backend-runtime';
import { EvaluationAdapter, EvaluationRunner } from './evaluation-runner';
import { EvaluationCase, NormalizedEvaluationResult, evaluationCaseSchema } from './evaluation-types';
import { generalFallbackEvaluationCases } from './cases';

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

class ConservativeFallbackAdapter implements EvaluationAdapter {
  constructor(private readonly artifactsByKey: Map<string, FixtureArtifact>) {}

  async evaluateCase(evalCase: EvaluationCase): Promise<NormalizedEvaluationResult> {
    const evidenceByArtifactKey: Record<string, string[]> = {};

    for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
      const artifact = this.artifactsByKey.get(artifactKey);
      if (artifact) {
        evidenceByArtifactKey[artifactKey] = [artifact.excerpt];
      }
    }

    return {
      foundImpactedArtifactKeys: evalCase.expected.impactedArtifactKeys,
      evidenceByArtifactKey,
      unknownsOrQuestions: evalCase.expected.unknownsOrQuestions ?? [],
      risks: evalCase.expected.risks ?? [],
      qaScenarios: evalCase.expected.qaScenarios ?? [],
      domainPackId: 'general',
      domainPackVersion: '0.0.0',
      matchedConceptKeys: [],
    };
  }
}

const businessChrome = (evalCase: EvaluationCase): string => [
  evalCase.requirementTitle,
  evalCase.requirementText,
  ...(evalCase.expected.unknownsOrQuestions ?? []),
  ...(evalCase.expected.risks ?? []),
  ...(evalCase.expected.qaScenarios ?? []),
].join(' ').toLowerCase();

describe('General domain FALLBACK evaluation cases', () => {
  let registry: DomainPackRegistry;
  let artifactsByKey: Map<string, FixtureArtifact>;

  beforeEach(() => {
    registry = new DomainPackRegistry();
    artifactsByKey = fixtureArtifacts();
  });

  it('declares general@0.0.0 as a safe FALLBACK profile', () => {
    const selection = registry.selectPack({ repositoryProfileDomain: 'UNKNOWN' });

    expect(selection.normalizedPackId).toBe('general');
    expect(selection.selectedBy).toBe('FALLBACK');
    expect(selection.pack.version).toBe('0.0.0');
    expect(selection.pack.status).toBe('FALLBACK');
    expect(selection.pack.concepts).toEqual([]);
    expect(selection.pack.retrievalHints).toEqual([]);
    expect(selection.pack.riskTemplates).toEqual([]);
    expect(selection.pack.qaTemplates).toEqual([]);
    expect(selection.pack.unknownTemplates).toEqual([]);
    expect(selection.pack.glossaryMetadata).toEqual([]);
  });

  it('emits bounded fallback status metadata for diagnostics', () => {
    const selection = registry.selectPack({ repositoryProfileDomain: 'UNSUPPORTED_DOMAIN' });
    const payload = {
      domainPackId: selection.pack.id,
      domainPackVersion: selection.pack.version,
      domainPackStatus: selection.pack.status,
      selectedBy: selection.selectedBy,
      conceptCount: selection.pack.concepts.length,
      retrievalHintCount: selection.pack.retrievalHints.length,
      riskTemplateCount: selection.pack.riskTemplates.length,
      qaTemplateCount: selection.pack.qaTemplates.length,
      unknownTemplateCount: selection.pack.unknownTemplates.length,
    };

    expect(domainPackAppliedDiagnosticPayloadSchema.parse(payload)).toMatchObject({
      domainPackId: 'general',
      domainPackVersion: '0.0.0',
      domainPackStatus: 'FALLBACK',
      selectedBy: 'FALLBACK',
    });
    expect(JSON.stringify(payload)).not.toContain('refund eligibility');
    expect(JSON.stringify(payload)).not.toContain('sourceCode');
    expect(JSON.stringify(payload)).not.toContain('qaTemplates');
  });

  it('keeps fallback cases schema-valid and concept-free', () => {
    expect(generalFallbackEvaluationCases.length).toBe(4);

    for (const evalCase of generalFallbackEvaluationCases) {
      expect(() => evaluationCaseSchema.parse(evalCase)).not.toThrow();
      expect(evalCase.domain?.packId).toBe('general');
      expect(evalCase.domain?.expectedConceptKeys).toEqual([]);
      expect(
        registry.matchConcepts(`${evalCase.requirementTitle} ${evalCase.requirementText}`, registry.getPackById('general')),
      ).toEqual([]);
    }
  });

  it('marks fallback unknowns, risks, and QA as uncertain rather than evidenced', () => {
    for (const evalCase of generalFallbackEvaluationCases) {
      for (const unknown of evalCase.expected.unknownsOrQuestions ?? []) {
        expect(unknown).toMatch(/^unknown:/);
      }
      for (const risk of evalCase.expected.risks ?? []) {
        expect(risk).toMatch(/^inferred risk:/);
      }
      for (const qaScenario of evalCase.expected.qaScenarios ?? []) {
        expect(qaScenario).toMatch(/^uncertain qa:/);
      }
    }
  });

  it('does not leak booking profile terminology into fallback business chrome', () => {
    const forbiddenTerms = ['booking', 'payment', 'refund', 'cancellation', 'notification'];

    for (const evalCase of generalFallbackEvaluationCases) {
      const text = businessChrome(evalCase);

      for (const term of forbiddenTerms) {
        expect(text).not.toContain(term);
      }
    }

    const generalPack = registry.getPackById('general');
    const bookingText = BookingDomainPack.concepts
      .flatMap((concept) => [concept.key, concept.label, ...concept.aliases])
      .join(' ');

    expect(registry.matchConcepts(bookingText, generalPack)).toEqual([]);
  });

  it('requires raw source excerpts for fallback impacted artifacts', () => {
    for (const evalCase of generalFallbackEvaluationCases) {
      for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
        const artifact = artifactsByKey.get(artifactKey);

        expect(artifact).toBeDefined();
        expect(artifact?.filePath).toMatch(/^src\//);
        expect(artifact?.startLine).toBeGreaterThan(0);
        expect(artifact?.endLine).toBeGreaterThanOrEqual(artifact?.startLine ?? 0);
        expect(artifact?.excerpt.trim().length).toBeGreaterThan(0);
        expect(artifactKey).not.toMatch(/^domain-pack:/);
      }
    }
  });

  it('reports conservative fallback evaluation without booking pack overclaim', async () => {
    const runner = new EvaluationRunner(
      new ConservativeFallbackAdapter(artifactsByKey),
      registry,
    );

    const result = await runner.run(generalFallbackEvaluationCases);

    expect(result.report.totalCases).toBe(4);
    expect(result.report.failedCases).toEqual([]);
    expect(result.report.domainPackSummary).toMatchObject({
      totalCasesWithDomain: 4,
      packIdsUsed: ['general'],
      conceptMatchRecall: '0%',
      missingExpectedConcepts: [],
      unexpectedMatchedConcepts: [],
    });

    for (const caseReport of result.report.cases) {
      expect(caseReport.domainPackId).toBe('general');
      expect(caseReport.domainPackVersion).toBe('0.0.0');
      expect(caseReport.expectedConceptKeys).toEqual([]);
      expect(caseReport.matchedConceptKeys).toEqual([]);
      expect(caseReport.evidenceCoverage).toBe('100.0%');
    }

    expect(result.textSummary).toContain('domain pack: general@0.0.0');
    expect(result.textSummary).not.toContain('booking@0.1.0');
    expect(result.textSummary).not.toContain('refund eligibility');
  });
});
