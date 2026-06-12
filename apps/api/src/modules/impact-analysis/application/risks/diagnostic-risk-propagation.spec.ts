import { RunImpactAnalysisUseCase } from '../lifecycle/run-impact-analysis.usecase';
import { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { ScanJobRepository } from '../../../scanner/infrastructure/scan-job.repository';
import { FakeLlmProvider } from '../../../ai/infrastructure/fake-ai.provider';
import { PrismaClient } from '@prisma/client';
import { DiagnosticItem } from '@ba-helper/analyzer';

describe('Diagnostic Risk Propagation', () => {
  let useCase: RunImpactAnalysisUseCase;
  let mockImpactRepo: any;
  let mockInsightRepo: jest.Mocked<InsightRepository>;
  let mockScanJobRepo: jest.Mocked<ScanJobRepository>; // Wait, scanJobRepo is not in the constructor! Let's just remove it.
  let mockPrisma: any;
  let mockTraceabilityRepo: any;
  let fakeLlmProvider: FakeLlmProvider;

  beforeEach(() => {
    mockInsightRepo = {
      upsertMany: jest.fn().mockResolvedValue([]),
      deleteByAnalysisId: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockScanJobRepo = {
      updateJobStatus: jest.fn().mockResolvedValue(undefined),
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
          commitSha: 'abc',
          repository: {
            canonicalUrl: 'url'
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

    const mockArtifactRepo = {
      listBySnapshot: jest.fn().mockResolvedValue([]),
    };

    const mockEvidenceRepo = {
      listBySnapshotId: jest.fn().mockResolvedValue([]),
      upsertMany: jest.fn().mockResolvedValue([]),
    };

    const mockDomainPackRegistry = {
      selectPack: jest.fn().mockReturnValue({
        enrichContext: jest.fn().mockReturnValue(''),
        pack: {
          id: 'test-pack',
          version: '1.0',
          concepts: [],
          retrievalHints: [],
          riskTemplates: [],
          qaTemplates: [],
          unknownTemplates: [],
        },
        selectedBy: 'default',
        normalizedPackId: 'test-pack',
      }),
    };

    const mockHybridRetrievalService = {
      retrieve: jest.fn().mockResolvedValue([]),
    };

    useCase = new RunImpactAnalysisUseCase(
      mockImpactRepo,
      mockArtifactRepo as any,
      mockEvidenceRepo as any,
      mockInsightRepo,
      mockTraceabilityRepo as any,
      fakeLlmProvider,
      mockHybridRetrievalService as any, // hybridRetrievalService
      mockDomainPackRegistry as any,
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
        commitSha: 'abc',
        diagnostics: diagnostics,
        repository: {
          canonicalUrl: 'url'
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

  it('attaches METHOD_NOT_EXTRACTED only to existing artifact context', async () => {
    // We mock that 'src/refund.controller.ts' is a retrieved artifact
    const mockHybridRetrievalService = useCase['retrievalService'] as any;
    mockHybridRetrievalService.retrieve.mockResolvedValue([
      { artifactKey: 'api:refund' }
    ]);
    const mockArtifactRepo = useCase['artifactRepo'] as any;
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
