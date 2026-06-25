import { RunImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/run-impact-analysis.usecase';
import { AppError } from '../../apps/api/src/shared/app-error';
import { FakeLlmProvider } from '../../apps/api/src/modules/ai/infrastructure/fake-ai.provider';
import { DomainPackRegistry } from '../../apps/api/src/modules/domain-pack/application/domain-pack.registry';
import { ImpactEvidenceCollectionStep } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/steps/impact-evidence-collection.step';
import { ImpactDiagnosticPropagationStep } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/steps/impact-diagnostic-propagation.step';
import { ImpactAiReasoningStep } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/steps/impact-ai-reasoning.step';

type StubArtifact = {
  id: string;
  artifactKey: string;
  artifactType: string;
  name: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
};

class StubImpactRepo {
  findById = async () => ({
    id: 'analysis-1',
    status: 'QUEUED',
    stage: 'WAITING',
    progress: 0,
    snapshot: {
      id: 'snap-1',
      analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
      coverageStatus: 'READY',
    },
    requirementRevision: {
      rawText: 'Allow users to cancel paid bookings and receive refund.',
    },
  });

  updateStatus = async (params: {
    id: string;
    status: string;
    stage: string;
    progress: number;
    metadata?: any;
    error?: any;
  }) => ({
    id: params.id,
    status: params.status,
    stage: params.stage,
    progress: params.progress,
    metadata: params.metadata,
    error: params.error,
  });
}

class StubArtifactRepo {
  constructor(private readonly artifacts: StubArtifact[]) {}

  listBySnapshot = async () => this.artifacts;
}

class StubEvidenceRepo {
  items: Array<{ provenanceKey: string; sourceType: string; artifactId: string }> = [];

  upsertMany = async (items: Array<{ provenanceKey: string; sourceType: string; artifactId: string }>) => {
    this.items = items;
    return items.map((item, index) => ({
      id: `e-${index + 1}`,
      artifactId: item.artifactId,
    }));
  };
}

class StubInsightRepo {
  created: Array<{ insightKey: string; certainty: string }> = [];
  evidenceLinks: Array<{ insightId: string; evidenceIds: string[] }> = [];

  upsertMany = async (items: Array<{ insightKey: string; certainty: string }>) => {
    this.created = items;
    return items.map((item, index) => ({
      id: `ins-${index + 1}`,
      insightKey: item.insightKey,
      certainty: item.certainty as 'EVIDENCED' | 'UNKNOWN' | 'INFERRED' | 'CONFLICTING',
    }));
  };

  linkEvidence = async (params: { insightId: string; evidenceIds: string[] }) => {
    this.evidenceLinks.push(params);
    return [];
  };
}

class StubTraceabilityRepo {
  links: Array<{ artifactId: string }> = [];
  evidenceLinks: Array<{ linkId: string; evidenceIds: string[] }> = [];

  upsertMany = async (items: Array<{ artifactId: string }>) => {
    this.links = items;
    return items.map((item, index) => ({
      id: `link-${index + 1}`,
      artifactId: item.artifactId,
    }));
  };

  linkEvidence = async (params: { linkId: string; evidenceIds: string[] }) => {
    this.evidenceLinks.push(params);
    return [];
  };
}

/**
 * StubRetrievalService: returns all provided artifacts as retrieved.
 * Also asserts that the caller passes domain='BOOKING'.
 */
class StubRetrievalService {
  constructor(private readonly artifacts: StubArtifact[]) {}

  retrieve = async (request: any) => {
    expect(request.domain).toBe('booking');
    return this.artifacts
      .filter(a => a.id !== 'noise-1') // simulate RAG filtering out irrelevant artifacts
      .map(a => ({
        artifactId: a.id,
        artifactKey: a.artifactKey,
        filePath: a.filePath,
        symbolName: a.name,
        artifactType: a.artifactType,
        score: 1.0,
        // For testing, let's just make the first 3 LEXICAL and the rest GRAPH so we get only 3 AFFECTED links
        retrievalMethod: ['a1', 'a2', 'a3'].includes(a.id) ? 'LEXICAL' : 'GRAPH',
      }));
  };
}

describe('RunImpactAnalysisUseCase', () => {
  it('persists evidence for required and expanded artifacts only', async () => {
    const artifacts: StubArtifact[] = [
      {
        id: 'a1',
        artifactKey: 'api:booking.controller.cancel',
        artifactType: 'API_ROUTE',
        name: 'BookingController.cancel',
        filePath: 'src/booking/booking.controller.ts',
        startLine: 8,
        endLine: 11,
      },
      {
        id: 'a2',
        artifactKey: 'service-method:booking.service.cancelBooking',
        artifactType: 'SERVICE_METHOD',
        name: 'BookingService.cancelBooking',
        filePath: 'src/booking/booking.service.ts',
        startLine: 15,
        endLine: 24,
      },
      {
        id: 'a3',
        artifactKey: 'service-method:payment.service.refund',
        artifactType: 'SERVICE_METHOD',
        name: 'PaymentService.refund',
        filePath: 'src/payment/payment.service.ts',
        startLine: 6,
        endLine: 10,
      },
      {
        id: 'a4',
        artifactKey: 'service-method:slot.service.releaseSlot',
        artifactType: 'SERVICE_METHOD',
        name: 'SlotService.releaseSlot',
        filePath: 'src/slot/slot.service.ts',
        startLine: 5,
        endLine: 7,
      },
      {
        id: 'a5',
        artifactKey: 'service-method:notification.service.notifyOwner',
        artifactType: 'SERVICE_METHOD',
        name: 'NotificationService.notifyOwner',
        filePath: 'src/notification/notification.service.ts',
        startLine: 5,
        endLine: 7,
      },
      {
        id: 'a6',
        artifactKey: 'entity:booking',
        artifactType: 'ENTITY',
        name: 'Booking',
        filePath: 'src/booking/booking.entity.ts',
        startLine: 6,
        endLine: 19,
      },
      {
        id: 'a7',
        artifactKey: 'entity:paymentTransaction',
        artifactType: 'ENTITY',
        name: 'PaymentTransaction',
        filePath: 'src/payment/payment.entity.ts',
        startLine: 6,
        endLine: 11,
      },
      {
        id: 'a8',
        artifactKey: 'test:booking.cancel.spec',
        artifactType: 'TEST',
        name: 'BookingService.cancelBooking.spec',
        filePath: 'src/booking/booking-cancel.spec.ts',
        startLine: 1,
        endLine: 16,
      },
      {
        id: 'noise-1',
        artifactKey: 'service-method:admin.refund-report.generateReport',
        artifactType: 'SERVICE_METHOD',
        name: 'AdminRefundReportService.generateReport',
        filePath: 'src/admin/refund-report.service.ts',
        startLine: 3,
        endLine: 5,
      },
    ];

    const evidenceRepo = new StubEvidenceRepo();
    const insightRepo = new StubInsightRepo();
    const traceabilityRepo = new StubTraceabilityRepo();
    const llmProvider = new FakeLlmProvider();

    const evidenceStep = new ImpactEvidenceCollectionStep(
      new StubArtifactRepo(artifacts) as any,
      evidenceRepo as any,
      traceabilityRepo as any,
      new StubRetrievalService(artifacts) as any
    );
    const diagnosticStep = new ImpactDiagnosticPropagationStep();
    const aiReasoningStep = new ImpactAiReasoningStep(llmProvider as any);

    const useCase = new RunImpactAnalysisUseCase(
      new StubImpactRepo() as any,
      insightRepo as any,
      new DomainPackRegistry(),
      evidenceStep as any,
      diagnosticStep as any,
      aiReasoningStep as any,
      { recordEvent: jest.fn() } as any
    );

    await useCase.execute({ analysisId: 'analysis-1', domain: 'BOOKING' });

    const evidenceKeys = evidenceRepo.items.map((item) => item.provenanceKey);

    const expectedEvidenceKeys = [
      'snapshot:snap-1:artifact:api:booking.controller.cancel',
      'snapshot:snap-1:artifact:entity:booking',
      'snapshot:snap-1:artifact:entity:paymentTransaction',
      'snapshot:snap-1:artifact:service-method:booking.service.cancelBooking',
      'snapshot:snap-1:artifact:service-method:notification.service.notifyOwner',
      'snapshot:snap-1:artifact:service-method:payment.service.refund',
      'snapshot:snap-1:artifact:service-method:slot.service.releaseSlot',
      'snapshot:snap-1:artifact:test:booking.cancel.spec',
    ];

    expect(evidenceKeys.sort()).toEqual(expectedEvidenceKeys.sort());

    const testEvidence = evidenceRepo.items.find(
      (item) => item.provenanceKey === 'snapshot:snap-1:artifact:test:booking.cancel.spec',
    );
    expect(testEvidence?.sourceType).toBe('TEST');

    const insightKeys = insightRepo.created.map((item) => item.insightKey);
    expect(insightKeys).toMatchObject([
      'claim:cancel-route',
      'claim:cancel-refund',
      'claim:release-slot',
      'claim:notify-owner',
      'unknown:refund-percentage',
      'unknown:refund-deadline',
      'unknown:who-may-cancel',
      'unknown:owner-approval',
      'unknown:slot-reopen',
    ]);

    expect(traceabilityRepo.links.map((link) => link.artifactId)).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
  });

  it('does not create refund claim when refund artifact is missing', async () => {
    const artifacts: StubArtifact[] = [
      {
        id: 'a1',
        artifactKey: 'api:booking.controller.cancel',
        artifactType: 'API_ROUTE',
        name: 'BookingController.cancel',
        filePath: 'src/booking/booking.controller.ts',
        startLine: 8,
        endLine: 11,
      },
      {
        id: 'a2',
        artifactKey: 'service-method:booking.service.cancelBooking',
        artifactType: 'SERVICE_METHOD',
        name: 'BookingService.cancelBooking',
        filePath: 'src/booking/booking.service.ts',
        startLine: 15,
        endLine: 24,
      },
    ];

    const insightRepo = new StubInsightRepo();
    const llmProvider = new FakeLlmProvider();

    const evidenceStep = new ImpactEvidenceCollectionStep(
      new StubArtifactRepo(artifacts) as any,
      new StubEvidenceRepo() as any,
      new StubTraceabilityRepo() as any,
      new StubRetrievalService(artifacts) as any
    );
    const diagnosticStep = new ImpactDiagnosticPropagationStep();
    const aiReasoningStep = new ImpactAiReasoningStep(llmProvider as any);

    const useCase = new RunImpactAnalysisUseCase(
      new StubImpactRepo() as any,
      insightRepo as any,
      new DomainPackRegistry(),
      evidenceStep as any,
      diagnosticStep as any,
      aiReasoningStep as any,
      { recordEvent: jest.fn() } as any
    );

    await useCase.execute({ analysisId: 'analysis-1', domain: 'BOOKING' });

    expect(
      insightRepo.created.some((item) => item.insightKey === 'claim:cancel-refund'),
    ).toBe(false);
  });

  it('domain pack hints alone do not create EVIDENCED impact and diagnostic is bounded', async () => {
    // Empty artifacts so no code evidence can be extracted
    const artifacts: StubArtifact[] = [];

    const impactRepo = new StubImpactRepo();
    const updateSpy = jest.spyOn(impactRepo, 'updateStatus');
    const insightRepo = new StubInsightRepo();
    const llmProvider = new FakeLlmProvider();

    const evidenceStep = new ImpactEvidenceCollectionStep(
      new StubArtifactRepo(artifacts) as any,
      new StubEvidenceRepo() as any,
      new StubTraceabilityRepo() as any,
      new StubRetrievalService(artifacts) as any
    );
    const diagnosticStep = new ImpactDiagnosticPropagationStep();
    const aiReasoningStep = new ImpactAiReasoningStep(llmProvider as any);

    const useCase = new RunImpactAnalysisUseCase(
      impactRepo as any,
      insightRepo as any,
      new DomainPackRegistry(),
      evidenceStep as any,
      diagnosticStep as any,
      aiReasoningStep as any,
      { recordEvent: jest.fn() } as any
    );

    await useCase.execute({ analysisId: 'analysis-1', domain: 'BOOKING' });

    // Ensure no EVIDENCED insight is created
    const evidencedCount = insightRepo.created.filter(i => i.certainty === 'EVIDENCED').length;
    expect(evidencedCount).toBe(0);

    // Get the final call to updateStatus
    const finalUpdateCall = updateSpy.mock.calls.find(call => call[0].stage === 'DONE');
    expect(finalUpdateCall).toBeDefined();
    
    const metadata = (finalUpdateCall![0] as any).metadata;
    const diagnostic = metadata?.diagnostics?.find((d: any) => d.code === 'DOMAIN_PACK_APPLIED');
    expect(diagnostic).toBeDefined();

    // Verify bounded fields
    expect(diagnostic.payload).toMatchObject({
      domainPackId: 'booking',
      domainPackVersion: expect.any(String),
      selectedBy: 'manual_config',
      conceptCount: expect.any(Number),
      retrievalHintCount: expect.any(Number),
      riskTemplateCount: expect.any(Number),
      qaTemplateCount: expect.any(Number),
      unknownTemplateCount: expect.any(Number),
    });

    // Verify excluded fields
    expect(diagnostic.payload.templateBodies).toBeUndefined();
    expect(diagnostic.payload.rawPrompts).toBeUndefined();
    expect(diagnostic.payload.sourceCode).toBeUndefined();
  });

  it('unknown profile emits general@0.0.0', async () => {
    class UnknownProfileRepo extends StubImpactRepo {
      findById = async () => ({
        id: 'analysis-1',
        status: 'QUEUED',
        stage: 'WAITING',
        progress: 0,
        snapshot: {
          id: 'snap-1',
          analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
          coverageStatus: 'READY',
          profile: { domain: 'UNKNOWN' },
        },
        requirementRevision: {
          rawText: '...',
        },
      });
    }

    const impactRepo = new UnknownProfileRepo();
    const updateSpy = jest.spyOn(impactRepo, 'updateStatus');
    const evidenceStep = new ImpactEvidenceCollectionStep(
      new StubArtifactRepo([]) as any,
      new StubEvidenceRepo() as any,
      new StubTraceabilityRepo() as any,
      new class { retrieve = async () => [] }() as any
    );
    const diagnosticStep = new ImpactDiagnosticPropagationStep();
    const aiReasoningStep = new ImpactAiReasoningStep(new FakeLlmProvider() as any);

    const useCase = new RunImpactAnalysisUseCase(
      impactRepo as any,
      new StubInsightRepo() as any,
      new DomainPackRegistry(),
      evidenceStep as any,
      diagnosticStep as any,
      aiReasoningStep as any,
      { recordEvent: jest.fn() } as any
    );

    await useCase.execute({ analysisId: 'analysis-1' });

    const finalUpdateCall = updateSpy.mock.calls.find(call => call[0].stage === 'DONE');
    const diagnostic = finalUpdateCall![0].metadata.diagnostics.find((d: any) => d.code === 'DOMAIN_PACK_APPLIED');

    expect(diagnostic.payload.domainPackId).toBe('general');
    expect(diagnostic.payload.domainPackVersion).toBe('0.0.0');
    expect(diagnostic.payload.domainPackStatus).toBe('FALLBACK');
    expect(diagnostic.payload.selectedBy).toBe('safe_default');
  });

  it('booking profile emits booking@0.1.0', async () => {
    class BookingProfileRepo extends StubImpactRepo {
      findById = async () => ({
        id: 'analysis-1',
        status: 'QUEUED',
        stage: 'WAITING',
        progress: 0,
        snapshot: {
          id: 'snap-1',
          analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
          coverageStatus: 'READY',
          profile: { domain: 'BOOKING' },
        },
        requirementRevision: {
          rawText: '...',
        },
      });
    }

    const impactRepo = new BookingProfileRepo();
    const updateSpy = jest.spyOn(impactRepo, 'updateStatus');
    const evidenceStep = new ImpactEvidenceCollectionStep(
      new StubArtifactRepo([]) as any,
      new StubEvidenceRepo() as any,
      new StubTraceabilityRepo() as any,
      new class { retrieve = async () => [] }() as any
    );
    const diagnosticStep = new ImpactDiagnosticPropagationStep();
    const aiReasoningStep = new ImpactAiReasoningStep(new FakeLlmProvider() as any);

    const useCase = new RunImpactAnalysisUseCase(
      impactRepo as any,
      new StubInsightRepo() as any,
      new DomainPackRegistry(),
      evidenceStep as any,
      diagnosticStep as any,
      aiReasoningStep as any,
      { recordEvent: jest.fn() } as any
    );

    await useCase.execute({ analysisId: 'analysis-1' });

    const finalUpdateCall = updateSpy.mock.calls.find(call => call[0].stage === 'DONE');
    const diagnostic = finalUpdateCall![0].metadata.diagnostics.find((d: any) => d.code === 'DOMAIN_PACK_APPLIED');

    expect(diagnostic.payload.domainPackId).toBe('booking');
    expect(diagnostic.payload.selectedBy).toBe('repository_profile');
  });

  it('rejects non-runnable analyses', async () => {
    class LockedImpactRepo extends StubImpactRepo {
      findById = async () => ({
        id: 'analysis-2',
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
        progress: 100,
        snapshot: {
          id: 'snap-1',
          analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
          coverageStatus: 'READY',
        },
        requirementRevision: {
          rawText: 'Allow users to cancel paid bookings and receive refund.',
        },
      });
    }

    const evidenceStep = new ImpactEvidenceCollectionStep(
      new StubArtifactRepo([]) as any,
      new StubEvidenceRepo() as any,
      new StubTraceabilityRepo() as any,
      new StubRetrievalService([]) as any
    );
    const diagnosticStep = new ImpactDiagnosticPropagationStep();
    const aiReasoningStep = new ImpactAiReasoningStep(undefined as any);

    const useCase = new RunImpactAnalysisUseCase(
      new LockedImpactRepo() as any,
      new StubInsightRepo() as any,
      new DomainPackRegistry(),
      evidenceStep as any,
      diagnosticStep as any,
      aiReasoningStep as any,
      { recordEvent: jest.fn() } as any
    );

    await expect(useCase.execute({ analysisId: 'analysis-2' })).rejects.toMatchObject({
      code: 'IMPACT_ANALYSIS_NOT_RUNNABLE',
    } as AppError);
  });
});
