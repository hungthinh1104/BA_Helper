import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  RunImpactAnalysisUseCase,
  ImpactEvidenceCollectionStep,
  ImpactDiagnosticPropagationStep,
  ImpactAiReasoningStep,
} from '@ba-helper/application';
import { DomainPackRegistry, FakeLlmProvider } from '@ba-helper/backend-runtime';

class StubImpactRepo {
  findById = async () => ({
    id: 'analysis-1',
    status: 'QUEUED',
    stage: 'WAITING',
    progress: 0,
	    snapshot: {
	      id: 'snap-1',
	      repositoryId: 'repo-1',
	      analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
	      coverageStatus: 'READY',
	      repository: { projectId: 'project-1' },
	    },
	    requirementRevision: {
	      rawText: 'Allow users to cancel paid bookings and receive refund.',
	      requirement: { projectId: 'project-1' },
	    },
  });

  updateStatus = async (params: { id: string; status: string; stage: string; progress: number }) => ({
    id: params.id,
    status: params.status,
    stage: params.stage,
    progress: params.progress,
  });
}

class StubArtifactRepo {
  listBySnapshot = async () => [
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
  ];
}

class StubEvidenceRepo {
  items: Array<{ id: string; artifactId: string | null; provenanceKey: string }> = [];

  upsertMany = async (items: Array<{ provenanceKey: string; artifactId: string | null }>) => {
    this.items = items.map((item, index) => ({
      id: `e-${index + 1}`,
      artifactId: item.artifactId ?? null,
      provenanceKey: item.provenanceKey,
    }));
    return this.items;
  };
}

class StubInsightRepo {
  created: Array<{ id: string; insightKey: string; certainty: string; description: string }> = [];

  upsertMany = async (items: Array<{ insightKey: string; certainty: string; description: string }>) => {
    const mapped = items.map((item, index) => ({
      ...item,
      id: `ins-${index + 1}`,
      certainty: item.certainty as 'EVIDENCED' | 'UNKNOWN' | 'INFERRED' | 'CONFLICTING',
    }));
    this.created = mapped;
    return mapped;
  };

  evidenceLinks: Array<{ insightId: string; evidenceIds: string[] }> = [];

  linkEvidence = async (params: { insightId: string; evidenceIds: string[] }) => {
    this.evidenceLinks.push(params);
    return [];
  };
}

class StubTraceabilityRepo {
  links: Array<{ artifactId: string; linkType: string; linkBasis: string }> = [];

  upsertMany = async (items: Array<{ artifactId: string; linkType: string; linkBasis: string }>) => {
    this.links = items;
    return items.map((item, index) => ({
      id: `link-${index + 1}`,
      artifactId: item.artifactId,
      linkType: item.linkType,
      linkBasis: item.linkBasis,
    }));
  };

  linkEvidence = async (params: { linkId: string; evidenceIds: string[] }) => {
    return [];
  };
}

class StubRetrievalService {
  retrieve = async (request: any) => {
    expect(request.domain).toBe('booking');
    return [
      { id: 'a1', artifactKey: 'api:booking.controller.cancel', filePath: 'src/booking/booking.controller.ts', name: 'BookingController.cancel', artifactType: 'API_ROUTE', retrievalMethod: 'LEXICAL' as const },
      { id: 'a2', artifactKey: 'service-method:booking.service.cancelBooking', filePath: 'src/booking/booking.service.ts', name: 'BookingService.cancelBooking', artifactType: 'SERVICE_METHOD', retrievalMethod: 'LEXICAL' as const },
      { id: 'a3', artifactKey: 'service-method:payment.service.refund', filePath: 'src/payment/payment.service.ts', name: 'PaymentService.refund', artifactType: 'SERVICE_METHOD', retrievalMethod: 'LEXICAL' as const },
      { id: 'a4', artifactKey: 'service-method:slot.service.releaseSlot', filePath: 'src/slot/slot.service.ts', name: 'SlotService.releaseSlot', artifactType: 'SERVICE_METHOD', retrievalMethod: 'GRAPH' as const },
      { id: 'a5', artifactKey: 'service-method:notification.service.notifyOwner', filePath: 'src/notification/notification.service.ts', name: 'NotificationService.notifyOwner', artifactType: 'SERVICE_METHOD', retrievalMethod: 'GRAPH' as const },
      { id: 'a6', artifactKey: 'entity:booking', filePath: 'src/booking/booking.entity.ts', name: 'Booking', artifactType: 'ENTITY', retrievalMethod: 'GRAPH' as const },
      { id: 'a7', artifactKey: 'entity:paymentTransaction', filePath: 'src/payment/payment.entity.ts', name: 'PaymentTransaction', artifactType: 'ENTITY', retrievalMethod: 'GRAPH' as const },
      { id: 'a8', artifactKey: 'test:booking.cancel.spec', filePath: 'src/booking/booking-cancel.spec.ts', name: 'BookingService.cancelBooking.spec', artifactType: 'TEST', retrievalMethod: 'GRAPH' as const },
    ].map(a => ({
      artifactId: a.id,
      artifactKey: a.artifactKey,
      filePath: a.filePath,
      symbolName: a.name,
      artifactType: a.artifactType,
      score: 1.0,
      retrievalMethod: a.retrievalMethod,
    }));
  };
}

describe('impact analysis fixture output', () => {
  it('matches expected impact and unknowns fixtures', async () => {
    const expectedImpactPath = resolve(
      __dirname,
      '../fixtures/nestjs-booking-with-payment/expected/impact-analysis.json',
    );
    const expectedUnknownsPath = resolve(
      __dirname,
      '../fixtures/nestjs-booking-with-payment/expected/unknowns.json',
    );

    const expectedImpact = JSON.parse(readFileSync(expectedImpactPath, 'utf-8')) as {
      insights: Array<{ insightKey: string; certainty: string; description: string }>;
      traceability: Array<{ artifactKey: string; linkType: string; linkBasis: string }>;
    };
    const expectedUnknowns = JSON.parse(readFileSync(expectedUnknownsPath, 'utf-8')) as {
      unknowns: Array<{ insightKey: string; description: string; reasoning: string }>;
    };

    const insightRepo = new StubInsightRepo();
    const traceabilityRepo = new StubTraceabilityRepo();
    const llmProvider = new FakeLlmProvider();

    const evidenceStep = new ImpactEvidenceCollectionStep(
      new StubArtifactRepo() as any,
      new StubEvidenceRepo() as any,
      traceabilityRepo as any,
      new StubRetrievalService() as any
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

    const claims = insightRepo.created.filter((item) => item.certainty === 'EVIDENCED');
    const unknowns = insightRepo.created.filter((item) => item.certainty === 'UNKNOWN');

    expect(claims.map((item) => ({
      insightKey: item.insightKey,
      certainty: item.certainty,
      description: item.description,
    }))).toEqual(expectedImpact.insights);

    expect(traceabilityRepo.links.map((link) => ({
      artifactId: link.artifactId,
      linkType: link.linkType,
      linkBasis: link.linkBasis,
    }))).toEqual([
      { artifactId: 'a1', linkType: 'AFFECTED', linkBasis: 'EVIDENCED' },
      { artifactId: 'a2', linkType: 'AFFECTED', linkBasis: 'EVIDENCED' },
      { artifactId: 'a3', linkType: 'AFFECTED', linkBasis: 'EVIDENCED' },
    ]);

    expect(unknowns.map((item) => ({
      insightKey: item.insightKey,
      description: item.description,
      reasoning: expectedUnknowns.unknowns.find((unknown) => unknown.insightKey === item.insightKey)?.reasoning,
    }))).toEqual(expectedUnknowns.unknowns);

    // INVARIANT: no EVIDENCED insight without evidence link
    const evidencedInsights = insightRepo.created.filter(i => (i as any).certainty === 'EVIDENCED');
    for (const insight of evidencedInsights) {
      const links = insightRepo.evidenceLinks.find(l => l.insightId === (insight as any).id);
      expect(links?.evidenceIds?.length).toBeGreaterThan(0);
    }
    
    // Ensure refund_percentage is UNKNOWN and has no evidence
    const refundPercentageInsight = insightRepo.created.find(i => i.insightKey === 'unknown:refund-percentage');
    expect((refundPercentageInsight as any)?.certainty).toBe('UNKNOWN');
    const refundLinks = insightRepo.evidenceLinks.find(l => l.insightId === (refundPercentageInsight as any)?.id);
    expect(refundLinks?.evidenceIds).toBeUndefined(); // or empty, but in fake provider it shouldn't be linked
  });
});
