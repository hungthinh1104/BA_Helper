import { domainPackAppliedDiagnosticPayloadSchema } from '@ba-helper/contracts';
import { DomainPackRegistry } from '../../apps/api/src/modules/domain-pack/application/domain-pack.registry';
import { HealthcareDomainPack } from '../../apps/api/src/modules/domain-pack/packs/healthcare.v0.1.0';
import { EvaluationAdapter, EvaluationRunner } from './evaluation-runner';
import { EvaluationCase, NormalizedEvaluationResult, evaluationCaseSchema } from './evaluation-types';
import { healthcarePartialEvaluationCases } from './cases';

type FixtureArtifact = {
  artifactKey: string;
  filePath: string;
  excerpt: string;
};

const fixtureArtifacts = new Map<string, FixtureArtifact>(
  [
    {
      artifactKey: 'api:appointment.controller.reschedule',
      filePath: 'src/appointment/appointment.controller.ts',
      excerpt: 'reschedule(@Param("id") id: string) { return this.appointments.rescheduleAppointment(id); }',
    },
    {
      artifactKey: 'service-method:appointment.service.rescheduleAppointment',
      filePath: 'src/appointment/appointment.service.ts',
      excerpt: 'rescheduleAppointment(id: string) { this.providerAvailability.reserveSlot(id); this.patientNotification.sendAppointmentReminder(id); }',
    },
    {
      artifactKey: 'service-method:provider-availability.service.reserveSlot',
      filePath: 'src/provider/provider-availability.service.ts',
      excerpt: 'reserveSlot(appointmentId: string) { return { appointmentId, status: "RESERVED" }; }',
    },
    {
      artifactKey: 'service-method:patient-notification.service.sendAppointmentReminder',
      filePath: 'src/notification/patient-notification.service.ts',
      excerpt: 'sendAppointmentReminder(patientId: string) { return this.mailer.send(patientId); }',
    },
    {
      artifactKey: 'api:claim.controller.updateStatus',
      filePath: 'src/claim/claim.controller.ts',
      excerpt: 'updateStatus(@Body() body: UpdateClaimStatusDto) { return this.claims.updateClaimStatus(body); }',
    },
    {
      artifactKey: 'service-method:insurance-claim.service.updateClaimStatus',
      filePath: 'src/claim/insurance-claim.service.ts',
      excerpt: 'updateClaimStatus(input: UpdateClaimStatusDto) { return this.billing.applyClaimAdjustment(input.claimId); }',
    },
    {
      artifactKey: 'service-method:billing-record.service.applyClaimAdjustment',
      filePath: 'src/billing/billing-record.service.ts',
      excerpt: 'applyClaimAdjustment(claimId: string) { return this.records.adjustForClaim(claimId); }',
    },
    {
      artifactKey: 'service-method:patient-notification.service.sendBillingNotice',
      filePath: 'src/notification/patient-notification.service.ts',
      excerpt: 'sendBillingNotice(patientId: string) { return this.mailer.send(patientId); }',
    },
    {
      artifactKey: 'api:prior-authorization.controller.recordDecision',
      filePath: 'src/authorization/prior-authorization.controller.ts',
      excerpt: 'recordDecision(@Body() body: AuthorizationDecisionDto) { return this.authorizations.applyDecision(body); }',
    },
    {
      artifactKey: 'service-method:prior-authorization.service.applyDecision',
      filePath: 'src/authorization/prior-authorization.service.ts',
      excerpt: 'applyDecision(decision: AuthorizationDecisionDto) { return this.labOrders.updateOrderHold(decision.orderId); }',
    },
    {
      artifactKey: 'service-method:lab-order.service.updateOrderHold',
      filePath: 'src/lab/lab-order.service.ts',
      excerpt: 'updateOrderHold(orderId: string) { return { orderId, holdUpdated: true }; }',
    },
    {
      artifactKey: 'service-method:clinical-decision.service.recommendTreatment',
      filePath: 'src/clinical/clinical-decision.service.ts',
      excerpt: 'recommendTreatment() { return "out-of-scope clinical decision support"; }',
    },
  ].map((artifact) => [artifact.artifactKey, artifact]),
);

class SourceBackedHealthcareAdapter implements EvaluationAdapter {
  async evaluateCase(evalCase: EvaluationCase): Promise<NormalizedEvaluationResult> {
    const evidenceByArtifactKey: Record<string, string[]> = {};

    for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
      const artifact = fixtureArtifacts.get(artifactKey);
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
      domainPackId: 'healthcare',
      domainPackVersion: '0.1.0',
      matchedConceptKeys: [],
    };
  }
}

describe('Healthcare admin domain PARTIAL evaluation cases', () => {
  let registry: DomainPackRegistry;

  beforeEach(() => {
    registry = new DomainPackRegistry();
  });

  it('requires explicit healthcare selection and resolves canonical metadata', () => {
    const fallback = registry.selectPack({ repositoryProfileDomain: 'HEALTHCARE' });
    expect(fallback.pack.id).toBe('general');
    expect(fallback.selectedBy).toBe('FALLBACK');

    const selection = registry.selectPack({ manualPackId: 'healthcare' });
    expect(selection.normalizedPackId).toBe('healthcare');
    expect(selection.selectedBy).toBe('EXPLICIT');
    expect(selection.pack.version).toBe('0.1.0');
    expect(selection.pack.status).toBe('PARTIAL');
    expect(selection.resolved).toMatchObject({
      requestedDomainPackId: 'healthcare',
      resolvedDomainPackId: 'healthcare',
      resolvedDomainPackVersion: '0.1.0',
      resolvedDomainPackStatus: 'PARTIAL',
      selectedBy: 'EXPLICIT',
    });
  });

  it('emits bounded PARTIAL diagnostic metadata without templates or source text', () => {
    const selection = registry.selectPack({ manualPackId: 'healthcare@0.1.0' });
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
      domainPackId: 'healthcare',
      domainPackVersion: '0.1.0',
      domainPackStatus: 'PARTIAL',
      selectedBy: 'EXPLICIT',
    });
    expect(JSON.stringify(payload)).not.toContain('medical advice');
    expect(JSON.stringify(payload)).not.toContain('sourceCode');
  });

  it('keeps healthcare partial cases schema-valid and bounded to admin workflows', () => {
    expect(healthcarePartialEvaluationCases.length).toBe(3);

    for (const evalCase of healthcarePartialEvaluationCases) {
      expect(() => evaluationCaseSchema.parse(evalCase)).not.toThrow();
      expect(evalCase.domain?.packId).toBe('healthcare');
      expect(evalCase.expected.negativeArtifactKeys).toContain(
        'service-method:clinical-decision.service.recommendTreatment',
      );
      expect(evalCase.expected.unknownsOrQuestions?.join(' ')).toContain('PARTIAL healthcare admin unknown:');
      expect(evalCase.expected.risks?.join(' ')).toContain('PARTIAL healthcare admin risk:');
      expect(evalCase.expected.qaScenarios?.join(' ')).toContain('PARTIAL healthcare admin QA:');
    }
  });

  it('matches healthcare admin concepts without implying clinical or compliance support', () => {
    const allExpectedConcepts = new Set<string>();

    for (const evalCase of healthcarePartialEvaluationCases) {
      const matchedConcepts = registry.matchConcepts(
        `${evalCase.requirementTitle} ${evalCase.requirementText}`,
        HealthcareDomainPack,
      );

      for (const concept of evalCase.domain?.expectedConceptKeys ?? []) {
        allExpectedConcepts.add(concept);
      }
      expect(matchedConcepts).toEqual(expect.arrayContaining(evalCase.domain?.expectedConceptKeys ?? []));
    }

    expect(allExpectedConcepts).toEqual(
      new Set([
        'appointment_scheduling',
        'provider',
        'patient_notification',
        'insurance_claim',
        'billing_record',
        'prior_authorization',
        'lab_order_tracking',
      ]),
    );
    expect(HealthcareDomainPack.status).toBe('PARTIAL');
    expect(HealthcareDomainPack.description).not.toContain('clinical decision support');
  });

  it('requires source evidence and keeps domain templates out of evidence', () => {
    const domainPackTemplates = [
      ...HealthcareDomainPack.retrievalHints,
      ...HealthcareDomainPack.riskTemplates,
      ...HealthcareDomainPack.qaTemplates,
      ...HealthcareDomainPack.unknownTemplates,
    ];

    for (const evalCase of healthcarePartialEvaluationCases) {
      for (const artifactKey of evalCase.expected.impactedArtifactKeys) {
        const artifact = fixtureArtifacts.get(artifactKey);

        expect(artifact).toBeDefined();
        expect(artifact?.filePath).toMatch(/^src\//);
        expect(artifact?.excerpt.trim().length).toBeGreaterThan(0);
        expect(artifactKey).not.toMatch(/^domain-pack:/);
        expect(domainPackTemplates).not.toContain(artifact?.excerpt);
      }
    }
  });

  it('reports bounded partial evaluation without upgrading healthcare to stable', async () => {
    const runner = new EvaluationRunner(
      new SourceBackedHealthcareAdapter(),
      registry,
    );

    const result = await runner.run(healthcarePartialEvaluationCases);

    expect(result.report.totalCases).toBe(3);
    expect(result.report.failedCases).toEqual([]);
    expect(result.report.domainPackSummary).toMatchObject({
      totalCasesWithDomain: 3,
      packIdsUsed: ['healthcare'],
      missingExpectedConcepts: [],
      unexpectedMatchedConcepts: [],
    });

    for (const caseReport of result.report.cases) {
      expect(caseReport.domainPackId).toBe('healthcare');
      expect(caseReport.domainPackVersion).toBe('0.1.0');
      expect(caseReport.evidenceCoverage).toBe('100.0%');
    }

    expect(HealthcareDomainPack.status).toBe('PARTIAL');
    expect(result.textSummary).toContain('domain pack: healthcare@0.1.0');
    expect(result.textSummary).not.toContain('clinical decision support');
    expect(result.textSummary).not.toContain('HIPAA-ready');
  });
});
