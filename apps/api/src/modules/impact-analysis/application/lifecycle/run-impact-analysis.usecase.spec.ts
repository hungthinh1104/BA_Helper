import { RunImpactAnalysisUseCase } from './run-impact-analysis.usecase';
import { ImpactEvidenceCollectionStep } from './steps/impact-evidence-collection.step';
import { ImpactDiagnosticPropagationStep } from './steps/impact-diagnostic-propagation.step';
import { ImpactAiReasoningStep } from './steps/impact-ai-reasoning.step';
import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { ArtifactRepository } from '../../../artifact/infrastructure/artifact.repository';
import { EvidenceRepository } from '../../../evidence/infrastructure/evidence.repository';
import { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';
import { LlmProvider } from '../../../ai/domain/llm-provider.interface';
import { HybridRetrievalService } from '../../../retrieval/application/hybrid-retrieval.service';
import { AppError } from '../../../../shared/app-error';
import { renderPrompt } from '../../../ai/domain/prompt-registry';
import { DomainPackRegistry } from '../../../domain-pack/application/domain-pack.registry';

jest.mock('../../../ai/domain/prompt-registry');

describe('RunImpactAnalysisUseCase', () => {
  let useCase: RunImpactAnalysisUseCase;
  let impactRepo: jest.Mocked<ImpactAnalysisRepository>;
  let artifactRepo: jest.Mocked<ArtifactRepository>;
  let evidenceRepo: jest.Mocked<EvidenceRepository>;
  let insightRepo: jest.Mocked<InsightRepository>;
  let traceabilityRepo: jest.Mocked<TraceabilityRepository>;
  let llmProvider: jest.Mocked<LlmProvider>;
  let retrievalService: jest.Mocked<HybridRetrievalService>;
  let domainPackRegistry: jest.Mocked<DomainPackRegistry>;
  let eventLogService: any;

  beforeEach(() => {
    impactRepo = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
    } as unknown as jest.Mocked<ImpactAnalysisRepository>;

    artifactRepo = {
      listBySnapshot: jest.fn(),
    } as unknown as jest.Mocked<ArtifactRepository>;

    evidenceRepo = {
      upsertMany: jest.fn(),
    } as unknown as jest.Mocked<EvidenceRepository>;

    insightRepo = {
      upsertMany: jest.fn(),
      linkEvidence: jest.fn(),
    } as unknown as jest.Mocked<InsightRepository>;

    traceabilityRepo = {
      upsertMany: jest.fn(),
      linkEvidence: jest.fn(),
    } as unknown as jest.Mocked<TraceabilityRepository>;

    llmProvider = {
      generateStructured: jest.fn(),
    } as unknown as jest.Mocked<LlmProvider>;

    retrievalService = {
      retrieve: jest.fn(),
    } as unknown as jest.Mocked<HybridRetrievalService>;

    domainPackRegistry = {
        selectPack: jest.fn().mockReturnValue({
          pack: {
            id: 'test-pack',
            version: '1.0',
            concepts: [],
            retrievalHints: [],
            riskTemplates: [],
            qaTemplates: [],
            unknownTemplates: [],
          },
          normalizedPackId: 'test-pack',
          selectedBy: 'safe_default',
        }),
    } as unknown as jest.Mocked<DomainPackRegistry>;

    const evidenceStep = new ImpactEvidenceCollectionStep(
      artifactRepo,
      evidenceRepo,
      traceabilityRepo,
      retrievalService,
    );
    const diagnosticStep = new ImpactDiagnosticPropagationStep();
    const aiReasoningStep = new ImpactAiReasoningStep(llmProvider);

    eventLogService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new RunImpactAnalysisUseCase(
      impactRepo,
      insightRepo,
      domainPackRegistry,
      evidenceStep,
      diagnosticStep,
      aiReasoningStep,
      eventLogService,
    );

    (renderPrompt as jest.Mock).mockReturnValue({
      systemPrompt: 'sys',
      userPrompt: 'user',
      version: 'v1',
    });
  });

  it('should throw if analysis not found', async () => {
    impactRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ analysisId: 'a1' }),
    ).rejects.toThrow(AppError);
  });

  it('should throw if analysis is not runnable', async () => {
    impactRepo.findById.mockResolvedValue({ status: 'COMPLETED' } as any);

    await expect(
      useCase.execute({ analysisId: 'a1' }),
    ).rejects.toThrow(AppError);
  });

  it('currently completes by saving metadata and moving to WAITING_FOR_REVIEW without document enqueue', async () => {
    const analysis = {
      id: 'a1',
      status: 'QUEUED',
      snapshot: { id: 's1', repositoryId: 'r1', analyzerVersion: '1.0', repository: { projectId: 'p1' }, profile: { domain: 'BOOKING' }, diagnostics: [] },
      requirementRevision: { rawText: 'cancel booking' },
    };
    impactRepo.findById.mockResolvedValue(analysis as any);
    artifactRepo.listBySnapshot.mockResolvedValue([
      { id: 'art1', artifactKey: 'api:booking.controller', artifactType: 'CODE', filePath: 'booking.ts', name: 'BookingController', startLine: 1, endLine: 10 } as any
    ]);
    retrievalService.retrieve.mockResolvedValue([
      { artifactKey: 'api:booking.controller', retrievalMethod: 'KEYWORD', score: 0.9, retrievalSignals: ['VECTOR'], suggestion: 'Check cancel' } as any
    ]);
    evidenceRepo.upsertMany.mockResolvedValue([
      { id: 'ev1', artifactId: 'art1', excerpt: 'code' } as any
    ]);
    traceabilityRepo.upsertMany.mockResolvedValue([
      { id: 'tl1', artifactId: 'art1' } as any
    ]);
    traceabilityRepo.linkEvidence.mockResolvedValue({ count: 1 } as any);

    llmProvider.generateStructured.mockResolvedValue({
      data: {
        insights: [
          { insightKey: 'i1', insightType: 'CLAIM', certainty: 'EVIDENCED', reviewStatus: 'NEEDS_REVIEW', confidence: 0.9, title: 'title', description: 'desc', evidenceKeys: ['api:booking.controller'] }
        ],
        unknowns: []
      },
      metadata: {
        provider: 'fake-provider',
        model: 'fake-model',
        inputTokens: 100,
        outputTokens: 50,
      }
    } as any);

    insightRepo.upsertMany.mockResolvedValue([
      { id: 'in1', insightKey: 'i1', certainty: 'EVIDENCED' } as any
    ]);
    insightRepo.linkEvidence.mockResolvedValue({ count: 1 } as any);

    await useCase.execute({ analysisId: 'a1', expandGraph: true, domain: 'booking' });

    // 1. Verify exact State Transitions Order
    expect(impactRepo.updateStatus).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'RUNNING', stage: 'RETRIEVING_EVIDENCE', progress: 10 }));
    expect(impactRepo.updateStatus).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'RUNNING', stage: 'RUNNING_AI_REASONING', progress: 60 }));
    
    // 2. Verify Final Completion Metadata & Status without document enqueue
    const finalUpdateCall = (impactRepo.updateStatus as jest.Mock).mock.calls[2][0];
    expect(finalUpdateCall).toEqual(expect.objectContaining({
      status: 'WAITING_FOR_REVIEW',
      stage: 'DONE',
      progress: 100,
      metadata: expect.objectContaining({
        retrieval: expect.objectContaining({ strategy: 'hybrid', maxArtifacts: 20 }),
        llm: expect.objectContaining({ provider: 'fake-provider', model: 'fake-model', inputTokens: 100 }),
        domainPack: expect.objectContaining({ id: 'test-pack' })
      })
    }));

    // 3. Verify Retrieval Provider Boundary
    expect(retrievalService.retrieve).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'p1',
      repositoryId: 'r1',
      snapshotId: 's1',
      changeRequest: 'cancel booking',
      domain: 'test-pack',
      expandGraph: true
    }));

    // 4. Verify Fake Provider Argument Boundary
    const promptArg = (llmProvider.generateStructured as jest.Mock).mock.calls[0][0];
    expect(promptArg).toEqual(expect.objectContaining({
      systemPrompt: 'sys',
      userPrompt: 'user'
    }));

    // 5. Verify Event Logs
    expect(eventLogService.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ANALYSIS_STARTED' }));
    expect(eventLogService.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ANALYSIS_EVIDENCE_RETRIEVED' }));
    expect(eventLogService.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ANALYSIS_AI_REASONING_COMPLETED' }));
    expect(eventLogService.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ANALYSIS_WAITING_FOR_REVIEW' }));
  });

  it('should mark analysis as FAILED if error occurs', async () => {
    const analysis = { id: 'a1', status: 'QUEUED', snapshot: { id: 's1' }, requirementRevision: {} };
    impactRepo.findById.mockResolvedValue(analysis as any);
    impactRepo.updateStatus.mockResolvedValue({} as any);
    
    artifactRepo.listBySnapshot.mockRejectedValue(new Error('DB Error'));

    await expect(useCase.execute({ analysisId: 'a1' })).rejects.toThrow('DB Error');

    expect(impactRepo.updateStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'FAILED',
      error: expect.objectContaining({ message: 'DB Error' })
    }));

    expect(eventLogService.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ANALYSIS_FAILED' }));
  });

  it('downgrades evidenced insights when no persisted evidence can be resolved', async () => {
    const analysis = {
      id: 'a1',
      status: 'QUEUED',
      snapshot: { id: 's1', repositoryId: 'r1', analyzerVersion: '1.0', diagnostics: [] },
      requirementRevision: { rawText: 'cancel booking' },
    };
    impactRepo.findById.mockResolvedValue(analysis as any);
    artifactRepo.listBySnapshot.mockResolvedValue([
      { id: 'art1', artifactKey: 'file1', artifactType: 'CODE', filePath: 'file1.ts', name: 'File1' } as any,
    ]);
    retrievalService.retrieve.mockResolvedValue([
      { artifactKey: 'file1', retrievalMethod: 'KEYWORD', score: 0.9 } as any,
    ]);
    evidenceRepo.upsertMany.mockResolvedValue([
      { id: 'ev1', artifactId: 'art1', excerpt: 'code' } as any,
    ]);
    traceabilityRepo.upsertMany.mockResolvedValue([{ id: 'tl1', artifactId: 'art1' } as any]);
    traceabilityRepo.linkEvidence.mockResolvedValue({ count: 1 } as any);

    llmProvider.generateStructured.mockResolvedValue({
      data: {
        insights: [
          {
            insightKey: 'i-no-evidence',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 0.7,
            title: 'title',
            description: 'desc',
            evidenceKeys: ['missing-artifact-key'],
          },
        ],
        unknowns: [],
      },
      metadata: {},
    } as any);

    insightRepo.upsertMany.mockResolvedValue([
      { id: 'in1', insightKey: 'i-no-evidence', certainty: 'INFERRED' } as any,
    ]);
    insightRepo.linkEvidence.mockResolvedValue([] as any);

    await useCase.execute({ analysisId: 'a1' });

    expect(insightRepo.upsertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          insightKey: 'i-no-evidence',
          certainty: 'INFERRED',
          metadata: expect.objectContaining({
            evidenceIntegrity:
              'EVIDENCED_DOWNGRADED_NO_PERSISTED_EVIDENCE',
            originalCertainty: 'EVIDENCED',
          }),
        }),
      ]),
    );
    expect(insightRepo.linkEvidence).not.toHaveBeenCalled();
  });
});
