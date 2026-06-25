import { domainPackAppliedDiagnosticPayloadSchema } from '@ba-helper/contracts';
import { DomainPackRegistry } from '../../apps/api/src/modules/domain-pack/application/domain-pack.registry';
import { RentalDomainPack } from '../../apps/api/src/modules/domain-pack/packs/rental.v0.1.0';
import { SafeFileEnumerator } from '../../packages/analyzer/src/scanner/core/safe-file-enumerator';
import { scanProject } from '../../packages/analyzer/src/scanner/scanner';
import { EvaluationAdapter, EvaluationRunner } from './evaluation-runner';
import { EvaluationCase, NormalizedEvaluationResult, evaluationCaseSchema } from './evaluation-types';
import { rentalPartialEvaluationCases } from './cases';
import type { ScanArtifact } from '../../packages/analyzer/src/scanner/scanner.types';

const fixturePath = `${process.cwd()}/tests/fixtures/nestjs-rental-partial`;

const scanRentalFixture = async (): Promise<Map<string, ScanArtifact>> => {
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

class SourceBackedRentalAdapter implements EvaluationAdapter {
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
      domainPackId: 'rental',
      domainPackVersion: '0.1.0',
      matchedConceptKeys: [],
    };
  }
}

describe('Rental domain PARTIAL evaluation cases', () => {
  let registry: DomainPackRegistry;
  let artifactsByKey: Map<string, ScanArtifact>;

  beforeAll(async () => {
    artifactsByKey = await scanRentalFixture();
  });

  beforeEach(() => {
    registry = new DomainPackRegistry();
  });

  it('declares rental@0.1.0 as a PARTIAL profile', () => {
    const selection = registry.selectPack({ manualPackId: 'rental@0.1.0' });

    expect(selection.normalizedPackId).toBe('rental');
    expect(selection.selectedBy).toBe('manual_config');
    expect(selection.pack.version).toBe('0.1.0');
    expect(selection.pack.status).toBe('PARTIAL');
    expect(selection.pack.glossaryMetadata).toEqual([
      { locale: 'en', status: 'foundation', version: '1.0.0', termCount: 9 },
      { locale: 'vi', status: 'foundation', version: '1.0.0', termCount: 9 },
    ]);
  });

  it('emits bounded PARTIAL status metadata for diagnostics', () => {
    const selection = registry.selectPack({ repositoryProfileDomain: 'RENTAL' });
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
      domainPackId: 'rental',
      domainPackVersion: '0.1.0',
      domainPackStatus: 'PARTIAL',
      selectedBy: 'repository_profile',
    });
    expect(JSON.stringify(payload)).not.toContain('PARTIAL rental hint:');
    expect(JSON.stringify(payload)).not.toContain('sourceCode');
  });

  it('keeps rental partial cases schema-valid and bounded', () => {
    expect(rentalPartialEvaluationCases.length).toBe(3);

    for (const evalCase of rentalPartialEvaluationCases) {
      expect(() => evaluationCaseSchema.parse(evalCase)).not.toThrow();
      expect(evalCase.domain?.packId).toBe('rental');
      expect(evalCase.expected.impactedArtifactKeys.length).toBeGreaterThan(0);
      expect(evalCase.expected.negativeArtifactKeys).toContain(
        'service-method:maintenance-request.service.openMaintenanceRequest',
      );
      expect(evalCase.expected.unknownsOrQuestions?.join(' ')).toContain('PARTIAL rental unknown:');
      expect(evalCase.expected.risks?.join(' ')).toContain('PARTIAL rental risk:');
      expect(evalCase.expected.qaScenarios?.join(' ')).toContain('PARTIAL rental QA:');
    }
  });

  it('matches rental concepts deterministically without claiming stable coverage', () => {
    const expectedConcepts = new Set<string>();

    for (const evalCase of rentalPartialEvaluationCases) {
      const matchedConcepts = registry.matchConcepts(
        `${evalCase.requirementTitle} ${evalCase.requirementText}`,
        RentalDomainPack,
      );

      for (const concept of evalCase.domain?.expectedConceptKeys ?? []) {
        expectedConcepts.add(concept);
      }
      expect(matchedConcepts).toEqual(expect.arrayContaining(evalCase.domain?.expectedConceptKeys ?? []));
    }

    expect(expectedConcepts).toEqual(
      new Set([
        'rental_contract',
        'deposit',
        'room_availability',
        'booking_request',
        'tenant',
        'landlord',
        'payment_record',
        'contract_transition',
      ]),
    );
    expect(expectedConcepts.has('maintenance_request')).toBe(false);
    expect(RentalDomainPack.status).toBe('PARTIAL');
  });

  it('requires source-code evidence for every expected impacted artifact', () => {
    for (const evalCase of rentalPartialEvaluationCases) {
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

  it('keeps rental hints and templates out of evidence', () => {
    const domainPackTemplates = [
      ...RentalDomainPack.retrievalHints,
      ...RentalDomainPack.riskTemplates,
      ...RentalDomainPack.qaTemplates,
      ...RentalDomainPack.unknownTemplates,
    ];

    for (const evalCase of rentalPartialEvaluationCases) {
      for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
        const artifact = artifactsByKey.get(artifactKey);

        expect(domainPackTemplates).not.toContain(artifact?.excerpt);
        expect(artifact?.filePath).not.toContain('domain-pack');
      }
    }
  });

  it('reports bounded partial evaluation without upgrading rental to stable', async () => {
    const runner = new EvaluationRunner(
      new SourceBackedRentalAdapter(artifactsByKey),
      registry,
    );

    const result = await runner.run(rentalPartialEvaluationCases);

    expect(result.report.totalCases).toBe(3);
    expect(result.report.failedCases).toEqual([]);
    expect(result.report.domainPackSummary).toMatchObject({
      totalCasesWithDomain: 3,
      packIdsUsed: ['rental'],
      missingExpectedConcepts: [],
      unexpectedMatchedConcepts: [],
    });

    for (const caseReport of result.report.cases) {
      expect(caseReport.domainPackId).toBe('rental');
      expect(caseReport.domainPackVersion).toBe('0.1.0');
      expect(caseReport.evidenceCoverage).toBe('100.0%');
    }

    expect(RentalDomainPack.status).toBe('PARTIAL');
    expect(result.textSummary).toContain('domain pack: rental@0.1.0');
    expect(result.textSummary).not.toContain('domain pack: rental@1.0.0');
  });
});
