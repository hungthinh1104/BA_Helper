import {
  RunImpactAnalysisUseCase,
  ImpactEvidenceCollectionStep,
  ImpactDiagnosticPropagationStep,
  ImpactAiReasoningStep,
} from '@ba-helper/application';
import type { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { FakeLlmProvider } from '../../../ai/infrastructure/fake-ai.provider';
import { PrismaClient } from '@prisma/client';
import type { DiagnosticItem } from '@ba-helper/analyzer';

describe('Diagnostic Risk Propagation', () => {
  let useCase: RunImpactAnalysisUseCase;
  let mockImpactRepo: any;
  let mockInsightRepo: jest.Mocked<InsightRepository>;
  let mockPrisma: any;
  let mockTraceabilityRepo: any;
  let fakeLlmProvider: FakeLlmProvider;
  let mockArtifactRepo: any;
  let mockEvidenceRepo: any;
  let mockHybridRetrievalService: any;

  beforeEach(() => {
    mockInsightRepo = {
      upsertMany: jest.fn().mockResolvedValue([]),
      deleteByAnalysisId: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockPrisma = {
      impactAnalysis: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
      repositorySnapshot: {
        findUnique: jest.fn(),
      },
      codeArtifact: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dependencyEdge: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      traceabilityLink: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    fakeLlmProvider = new FakeLlmProvider();
    // Stub LLM to return nothing so we ONLY test diagnostics
    jest.spyOn(fakeLlmProvider, 'generateStructured').mockResolvedValue({
      data: { insights: [], clarifications: [], unknowns: [], acceptanceCriteria: [], qaScenarios: [] } as any,
      metadata: {
        provider: 'fake',
        model: 'fake-model',
        promptVersion: '1.0',
        durationMs: 100,
      },
    });

    mockImpactRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'analysis-123',
        status: 'RUNNING',
        snapshotId: 'snap-123',
        requirementRevision: {
          rawText: 'We need to process refunds.',
          title: 'Refund Processing',
        },
        sourceTarget: {
          requestedRef: 'main'
        },
        snapshot: {
          id: 'snap-123',
          repositoryId: 'repo-123',
          commitSha: 'abc',
          repository: {
            canonicalUrl: 'url',
            projectId: 'project-123',
          }
        }
      }),
      update: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    mockTraceabilityRepo = {
      findByAnalysisId: jest.fn().mockResolvedValue([]),
      upsertMany: jest.fn().mockResolvedValue([]),
    };

    mockArtifactRepo = {
      listBySnapshot: jest.fn().mockResolvedValue([]),
    };

    mockEvidenceRepo = {
      listBySnapshotId: jest.fn().mockResolvedValue([]),
      upsertMany: jest.fn().mockResolvedValue([]),
    };

    const mockDomainPackRegistry = {
      selectPack: jest.fn().mockReturnValue({
        enrichContext: jest.fn().mockReturnValue(''),
        pack: {
          id: 'test-pack',
          version: '1.0',
          status: 'EXPERIMENTAL',
          concepts: [],
          retrievalHints: [],
          riskTemplates: [],
          qaTemplates: [],
          unknownTemplates: [],
        },
        selectedBy: 'FALLBACK',
        normalizedPackId: 'test-pack',
      }),
    };

    mockHybridRetrievalService = {
      retrieve: jest.fn().mockResolvedValue([]),
    };

    const evidenceStep = new ImpactEvidenceCollectionStep(
      mockArtifactRepo as any,
      mockEvidenceRepo as any,
      mockTraceabilityRepo as any,
      mockHybridRetrievalService as any,
    );
    const diagnosticStep = new ImpactDiagnosticPropagationStep();
    const aiReasoningStep = new ImpactAiReasoningStep(fakeLlmProvider);

    useCase = new RunImpactAnalysisUseCase(
      mockImpactRepo,
      mockInsightRepo,
      mockDomainPackRegistry as any,
      evidenceStep,
      diagnosticStep,
      aiReasoningStep,
      { recordEvent: jest.fn() } as any
    );
  });

  const setupMockSnapshot = (diagnostics: DiagnosticItem[]) => {
    mockImpactRepo.findById.mockResolvedValue({
      id: 'analysis-123',
      status: 'RUNNING',
      snapshotId: 'snap-123',
      requirementRevision: {
        rawText: 'We need to process refunds.',
        title: 'Refund Processing',
      },
      sourceTarget: {
        requestedRef: 'main'
      },
      snapshot: {
        id: 'snap-123',
        repositoryId: 'repo-123',
        commitSha: 'abc',
        diagnostics: diagnostics,
        repository: {
          canonicalUrl: 'url',
          projectId: 'project-123',
        }
      }
    });

    mockPrisma.repositorySnapshot.findUnique.mockResolvedValue({
      id: 'snap-123',
      diagnostics: diagnostics as any,
    });
  };

  it('propagates relevant diagnostics and suppresses irrelevant ones', async () => {
    setupMockSnapshot([
      {
        code: 'UNSUPPORTED_FRAMEWORK_FEATURE',
        severity: 'WARN',
        message: 'Unsupported Route::resource',
        category: 'SCANNER',
        payload: {
          candidateTerms: ['refunds'],
          relativePath: 'routes/web.php',
          unsupportedPattern: 'Route::resource',
        },
      },
      {
        code: 'UNSUPPORTED_FRAMEWORK_FEATURE',
        severity: 'WARN',
        message: 'Unsupported Route::resource',
        category: 'SCANNER',
        payload: {
          candidateTerms: ['users'], // Irrelevant to 'refunds'
          relativePath: 'routes/web.php',
          unsupportedPattern: 'Route::resource',
        },
      },
    ]);

    await useCase.execute({ analysisId: 'analysis-123' });

    expect(mockInsightRepo.upsertMany).toHaveBeenCalledTimes(1);
    const savedInsights = mockInsightRepo.upsertMany.mock.calls[0][0];

    expect(savedInsights.length).toBe(1);
    expect(savedInsights[0].insightType).toBe('UNKNOWN');
    expect(savedInsights[0].title).toContain('Unsupported Scanner Pattern: UNSUPPORTED_FRAMEWORK_FEATURE');
    expect(savedInsights[0].reasoning).toContain('routes/web.php');
    expect(savedInsights[0].metadata).toEqual({
      origin: 'SCANNER_DIAGNOSTIC',
      evidenceMode: 'DIAGNOSTIC_ONLY',
      diagnosticRiskCategory: 'LEXICAL',
      diagnosticPayload: expect.any(Object),
    });
  });

  it('groups duplicate diagnostics', async () => {
    setupMockSnapshot([
      {
        code: 'UNSUPPORTED_FRAMEWORK_FEATURE',
        severity: 'WARN',
        message: 'Unsupported Router Group',
        category: 'SCANNER',
        payload: {
          candidateTerms: ['refunds'],
          relativePath: 'main.go',
          unsupportedPattern: 'gin.Group',
        },
      },
      {
        code: 'UNSUPPORTED_FRAMEWORK_FEATURE',
        severity: 'WARN',
        message: 'Unsupported Router Group',
        category: 'SCANNER',
        payload: {
          candidateTerms: ['refunds'],
          relativePath: 'main.go',
          unsupportedPattern: 'gin.Group',
        },
      },
    ]);

    await useCase.execute({ analysisId: 'analysis-123' });

    expect(mockInsightRepo.upsertMany).toHaveBeenCalledTimes(1);
    const savedInsights = mockInsightRepo.upsertMany.mock.calls[0][0];
    
    // Should group the two identical diagnostics into one risk
    expect(savedInsights.length).toBe(1);
    expect(savedInsights[0].title).toContain('Unsupported Scanner Pattern: UNSUPPORTED_FRAMEWORK_FEATURE');
    expect(savedInsights[0].reasoning).toContain('main.go');
  });

  it('never propagates SCANNER_CAPABILITY_SUMMARY', async () => {
    setupMockSnapshot([
      {
        code: 'SCANNER_CAPABILITY_SUMMARY',
        severity: 'INFO',
        message: 'Scanner capability profile injected',
        category: 'SCANNER',
        payload: {
          candidateTerms: ['refunds'], // Even if it contains relevant terms
        },
      },
    ]);

    await useCase.execute({ analysisId: 'analysis-123' });

    expect(mockInsightRepo.upsertMany).toHaveBeenCalledWith([]);
  });

  it('does not propagate context-only diagnostics without artifact context', async () => {
    setupMockSnapshot([
      {
        code: 'GO_ROUTE_GROUP_BOUNDARY',
        severity: 'WARN',
        message: 'Route group boundary was not expanded',
        category: 'SCANNER',
        payload: {
          candidateTerms: ['refunds'],
          relativePath: 'src/other.go',
        },
      },
      {
        code: 'REPO_LIMIT_EXCEEDED',
        severity: 'WARN',
        message: 'Repository exceeded scan limits',
        category: 'LIMIT',
        samplePaths: ['src/other.go'],
      },
    ]);

    await useCase.execute({ analysisId: 'analysis-123' });

    expect(mockInsightRepo.upsertMany).toHaveBeenCalledWith([]);
  });

  it('attaches METHOD_NOT_EXTRACTED only to existing artifact context', async () => {
    // We mock that 'src/refund.controller.ts' is a retrieved artifact
    mockHybridRetrievalService.retrieve.mockResolvedValue([
      { artifactKey: 'api:refund' }
    ]);
    mockArtifactRepo.listBySnapshot.mockResolvedValue([
      { artifactKey: 'api:refund', filePath: 'src/refund.controller.ts' }
    ]);

    setupMockSnapshot([
      {
        code: 'METHOD_NOT_EXTRACTED',
        severity: 'WARN',
        message: 'Method body skipped',
        category: 'SCANNER',
        payload: {
          relativePath: 'src/refund.controller.ts', // Matches artifact context!
        },
      },
      {
        code: 'METHOD_NOT_EXTRACTED',
        severity: 'WARN',
        message: 'Method body skipped',
        category: 'SCANNER',
        payload: {
          relativePath: 'src/other.controller.ts', // NO artifact context, should be ignored
        },
      },
    ]);

    await useCase.execute({ analysisId: 'analysis-123' });

    expect(mockInsightRepo.upsertMany).toHaveBeenCalledTimes(1);
    const savedInsights = mockInsightRepo.upsertMany.mock.calls[0][0];

    expect(savedInsights.length).toBe(1);
    expect(savedInsights[0].title).toContain('Unsupported Scanner Pattern: METHOD_NOT_EXTRACTED');
    expect(savedInsights[0].reasoning).toContain('src/refund.controller.ts');
  });
});
