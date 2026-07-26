import { domainPackAppliedDiagnosticPayloadSchema } from '@ba-helper/contracts';
import { DomainPackRegistry } from '@ba-helper/backend-runtime';
import { EcommerceDomainPack } from '@ba-helper/backend-runtime';
import { SafeFileEnumerator } from '../../packages/analyzer/src/scanner/core/safe-file-enumerator';
import { scanProject } from '../../packages/analyzer/src/scanner/scanner';
import { EvaluationAdapter, EvaluationRunner } from './evaluation-runner';
import { EvaluationCase, NormalizedEvaluationResult, evaluationCaseSchema } from './evaluation-types';
import { ecommercePartialEvaluationCases } from './cases';
import type { ScanArtifact } from '../../packages/analyzer/src/scanner/scanner.types';

const fixturePath = `${process.cwd()}/tests/fixtures/nestjs-order-inventory`;

const scanEcommerceFixture = async (): Promise<Map<string, ScanArtifact>> => {
  const enumerator = new SafeFileEnumerator(fixturePath);
  const enumResult = await enumerator.enumerate();
  const scanResult = scanProject({
    fixturePath,
    tsFiles: enumResult.tsFiles,
    coverage: {
      status: enumResult.isPartial ? 'PARTIAL' : 'FULL',
      skippedFiles: enumResult.skippedFiles,
      skippedSummary: enumResult.skippedSummary,
      limits: enumResult.limits,
      limitHits: enumResult.limitHits,
    },
  });

  return new Map(scanResult.artifacts.map((artifact) => [artifact.stableId, artifact]));
};

class SourceBackedEcommerceAdapter implements EvaluationAdapter {
  constructor(private readonly artifactsByKey: Map<string, ScanArtifact>) {}

  async evaluateCase(evalCase: EvaluationCase): Promise<NormalizedEvaluationResult> {
    const evidenceByArtifactKey: Record<string, string[]> = {};

    for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
      const artifact = this.artifactsByKey.get(artifactKey);
      if (artifact?.excerpt) {
        evidenceByArtifactKey[artifactKey] = [artifact.excerpt];
      }
    }

    return {
      foundImpactedArtifactKeys: evalCase.expected.impactedArtifactKeys,
      evidenceByArtifactKey,
      unknownsOrQuestions: evalCase.expected.unknownsOrQuestions ?? [],
      risks: evalCase.expected.risks ?? [],
      qaScenarios: evalCase.expected.qaScenarios ?? [],
      domainPackId: 'ecommerce',
      domainPackVersion: '0.1.0',
      matchedConceptKeys: [],
    };
  }
}

describe('Ecommerce domain PARTIAL evaluation cases', () => {
  let registry: DomainPackRegistry;
  let artifactsByKey: Map<string, ScanArtifact>;

  beforeAll(async () => {
    artifactsByKey = await scanEcommerceFixture();
  });

  beforeEach(() => {
    registry = new DomainPackRegistry();
  });

  it('requires explicit ecommerce selection and resolves canonical metadata', () => {
    const fallback = registry.selectPack({ repositoryProfileDomain: 'ECOMMERCE' });
    expect(fallback.pack.id).toBe('general');
    expect(fallback.selectedBy).toBe('FALLBACK');

    const selection = registry.selectPack({ manualPackId: 'ecommerce' });
    expect(selection.normalizedPackId).toBe('ecommerce');
    expect(selection.selectedBy).toBe('EXPLICIT');
    expect(selection.pack.version).toBe('0.1.0');
    expect(selection.pack.status).toBe('PARTIAL');
    expect(selection.resolved).toMatchObject({
      requestedDomainPackId: 'ecommerce',
      resolvedDomainPackId: 'ecommerce',
      resolvedDomainPackVersion: '0.1.0',
      resolvedDomainPackStatus: 'PARTIAL',
      selectedBy: 'EXPLICIT',
    });
  });

  it('emits bounded PARTIAL diagnostic metadata without templates or source text', () => {
    const selection = registry.selectPack({ manualPackId: 'ecommerce@0.1.0' });
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
      domainPackId: 'ecommerce',
      domainPackVersion: '0.1.0',
      domainPackStatus: 'PARTIAL',
      selectedBy: 'EXPLICIT',
    });
    expect(JSON.stringify(payload)).not.toContain('payment compliance');
    expect(JSON.stringify(payload)).not.toContain('sourceCode');
  });

  it('keeps ecommerce partial cases schema-valid and bounded', () => {
    expect(ecommercePartialEvaluationCases.length).toBe(3);

    for (const evalCase of ecommercePartialEvaluationCases) {
      expect(() => evaluationCaseSchema.parse(evalCase)).not.toThrow();
      expect(evalCase.domain?.packId).toBe('ecommerce');
      expect(evalCase.expected.negativeArtifactKeys).toContain(
        'service-method:discount.service.applyDiscountToOrder',
      );
      expect(evalCase.expected.unknownsOrQuestions?.join(' ')).toContain('PARTIAL ecommerce unknown:');
      expect(evalCase.expected.risks?.join(' ')).toContain('PARTIAL ecommerce risk:');
      expect(evalCase.expected.qaScenarios?.join(' ')).toContain('PARTIAL ecommerce QA:');
    }
  });

  it('matches ecommerce concepts without implying payment compliance or fraud support', () => {
    const allExpectedConcepts = new Set<string>();

    for (const evalCase of ecommercePartialEvaluationCases) {
      const matchedConcepts = registry.matchConcepts(
        `${evalCase.requirementTitle} ${evalCase.requirementText}`,
        EcommerceDomainPack,
      );

      for (const concept of evalCase.domain?.expectedConceptKeys ?? []) {
        allExpectedConcepts.add(concept);
      }
      expect(matchedConcepts).toEqual(expect.arrayContaining(evalCase.domain?.expectedConceptKeys ?? []));
    }

    expect(allExpectedConcepts).toEqual(
      new Set([
        'order',
        'shipment',
        'inventory_reservation',
        'return_refund',
        'cart',
        'checkout',
        'payment_intent',
      ]),
    );
    expect(allExpectedConcepts.has('customer_notification')).toBe(false);
    expect(EcommerceDomainPack.status).toBe('PARTIAL');
    expect(EcommerceDomainPack.riskTemplates.join(' ')).toContain('does not provide payment compliance');
  });

  it('requires source-code evidence for every expected impacted artifact', () => {
    for (const evalCase of ecommercePartialEvaluationCases) {
      for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
        const artifact = artifactsByKey.get(artifactKey);

        expect(artifact).toBeDefined();
        expect(artifact?.filePath).toMatch(/^src\//);
        expect(artifact?.startLine).toBeGreaterThan(0);
        expect(artifact?.endLine).toBeGreaterThanOrEqual(artifact?.startLine ?? 0);
        expect(artifact?.excerpt?.trim().length).toBeGreaterThan(0);
        expect(artifactKey).not.toMatch(/^domain-pack:/);
      }
    }
  });

  it('keeps ecommerce hints and templates out of evidence', () => {
    const domainPackTemplates = [
      ...EcommerceDomainPack.retrievalHints,
      ...EcommerceDomainPack.riskTemplates,
      ...EcommerceDomainPack.qaTemplates,
      ...EcommerceDomainPack.unknownTemplates,
    ];

    for (const evalCase of ecommercePartialEvaluationCases) {
      for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
        const artifact = artifactsByKey.get(artifactKey);

        expect(domainPackTemplates).not.toContain(artifact?.excerpt);
        expect(artifact?.filePath).not.toContain('domain-pack');
      }
    }
  });

  it('reports bounded partial evaluation without upgrading ecommerce to stable', async () => {
    const runner = new EvaluationRunner(
      new SourceBackedEcommerceAdapter(artifactsByKey),
      registry,
    );

    const result = await runner.run(ecommercePartialEvaluationCases);

    expect(result.report.totalCases).toBe(3);
    expect(result.report.failedCases).toEqual([]);
    expect(result.report.domainPackSummary).toMatchObject({
      totalCasesWithDomain: 3,
      packIdsUsed: ['ecommerce'],
      missingExpectedConcepts: [],
      unexpectedMatchedConcepts: [],
    });

    for (const caseReport of result.report.cases) {
      expect(caseReport.domainPackId).toBe('ecommerce');
      expect(caseReport.domainPackVersion).toBe('0.1.0');
      expect(caseReport.evidenceCoverage).toBe('100.0%');
    }

    expect(EcommerceDomainPack.status).toBe('PARTIAL');
    expect(result.textSummary).toContain('domain pack: ecommerce@0.1.0');
    expect(result.textSummary).not.toContain('payment compliance validation passed');
    expect(result.textSummary).not.toContain('fraud scoring');
  });
});
