import type { AppError } from '@ba-helper/shared';
import { RunScanJobPersistenceStep } from './run-scan-job-persistence.step';
import { RunScanJobUseCase } from './run-scan-job.usecase';
import * as fs from 'node:fs/promises';
import { ScanJobStage, ScanJobStatus } from '@prisma/client';

jest.mock('node:fs/promises', () => ({
  mkdtemp: jest.fn(),
  rm: jest.fn(),
}));

jest.mock('@ba-helper/analyzer', () => {
  class ScannerAdapterRegistry {
    getAdapter(lang: string, fw: string) {
      if (lang === 'UNKNOWN' || lang === 'python') {
        throw new Error('No scanner adapter found');
      }
      return {
        adapterVersion: '0.2.0',
        scan: async (input: any) => {
          const analyzerMock = require('@ba-helper/analyzer');
          let capability: any = { adapterVersion: '0.2.0' };
          let capabilityDiagnostic: any = { code: 'SCANNER_CAPABILITY_SUMMARY', severity: 'INFO' };
          let result: any;

          if (lang === 'java') {
            result = analyzerMock.scanJavaSpringProject(input);
            capability = {
              language: 'java',
              framework: 'spring',
              status: 'PARTIAL',
              confidence: 'MEDIUM',
              adapterVersion: '0.2.0',
            };
            capabilityDiagnostic = {
              code: 'SCANNER_CAPABILITY_SUMMARY',
              severity: 'INFO',
              payload: { ...capability }
            };
          } else if (lang === 'go') {
            result = analyzerMock.scanGoHttpProject(input);
            capability = {
              language: 'go',
              framework: fw,
              status: 'EXPERIMENTAL',
              confidence: 'MEDIUM',
              adapterVersion: '0.2.0',
            };
            capabilityDiagnostic = {
              code: 'SCANNER_CAPABILITY_SUMMARY',
              severity: 'INFO',
              payload: { ...capability }
            };
          } else {
            result = analyzerMock.scanProject(input);
          }
          return {
            artifacts: result?.artifacts || [],
            dependencyEdges: result?.dependencyEdges || [],
            diagnostics: result?.diagnostics ? [...result.diagnostics, capabilityDiagnostic] : [capabilityDiagnostic],
            capability
          };
        }
      };
    }
  }

  return {
    GitHubUrlValidator: {
      validate: jest.fn(),
    },
  GitRepositoryFetcher: {
    fetch: jest.fn(),
  },
  FrameworkDetector: {
    detect: jest.fn(),
  },
  RepositoryProfileDetector: {
    detect: jest.fn(),
  },
  SafeFileEnumerator: jest.fn(),
  SecretRedactor: {
    redact: jest.fn((content: string) => ({
      redactedContent: content,
      foundSecrets: false,
    })),
  },
  DiagnosticCollector: class {
    private readonly items: any[] = [];

    add(item: any) {
      this.items.push(item);
    }

    addFromFileDiagnostic(item: any) {
      this.items.push(item);
    }

    addSecretRedacted(relativePath: string) {
      this.items.push({ code: 'SECRET_REDACTED', samplePaths: [relativePath] });
    }

    getItems() {
      return this.items;
    }
  },
  scanProject: jest.fn(),
  scanJavaSpringProject: jest.fn(),
  scanGoHttpProject: jest.fn(),
  scanFixture: jest.fn(),
  ScannerAdapterRegistry,
  };
});

const analyzer = jest.requireMock('@ba-helper/analyzer') as {
  GitHubUrlValidator: { validate: jest.Mock };
  GitRepositoryFetcher: { fetch: jest.Mock };
  FrameworkDetector: { detect: jest.Mock };
  RepositoryProfileDetector: { detect: jest.Mock };
  SafeFileEnumerator: jest.Mock;
  scanProject: jest.Mock;
  scanJavaSpringProject: jest.Mock;
  scanGoHttpProject: jest.Mock;
};

describe('RunScanJobUseCase', () => {
  const originalPreserveScanWorkspaceEnv = process.env.BA_HELPER_PRESERVE_SCAN_WORKSPACE;
  let useCase: RunScanJobUseCase;
  let scanJobRepository: any;
  let artifactRepository: any;
  let graphRepository: any;
  let eventLogService: any;
  let evidenceRepo: any;
  let prisma: any;
  let queueService: any;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.BA_HELPER_PRESERVE_SCAN_WORKSPACE;
    const secretRedactor = (
      jest.requireMock('@ba-helper/analyzer') as {
        SecretRedactor: { redact: jest.Mock };
      }
    ).SecretRedactor;
    secretRedactor.redact.mockImplementation((content: string) => ({
      redactedContent: content,
      foundSecrets: false,
    }));

    scanJobRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'job-1',
        repositoryId: 'repo-1',
        requestedRef: 'main',
        status: 'QUEUED',
        repository: { canonicalUrl: 'https://github.com/owner/repo' },
      }),
      updateState: jest.fn().mockResolvedValue(undefined),
      updateDiagnostics: jest.fn().mockResolvedValue(undefined),
    };

    artifactRepository = {
      createMany: jest.fn().mockResolvedValue(undefined),
      listBySnapshot: jest.fn().mockResolvedValue([
        {
          id: 'artifact-1',
          artifactKey: 'api:booking.controller.cancel',
        },
      ]),
    };

    eventLogService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };

    evidenceRepo = {
      upsertMany: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      repositoryTarget: { upsert: jest.fn().mockResolvedValue({ id: 'target-1' }) },
      repositorySnapshot: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'snapshot-1' }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      repositoryProfile: {
        upsert: jest.fn().mockResolvedValue({ id: 'profile-1' }),
      },
      scanJob: { update: jest.fn().mockResolvedValue(undefined) },
    };
    prisma.$transaction = jest.fn(async (callback: (tx: any) => unknown) =>
      callback(prisma),
    );

    queueService = {
      enqueueSnapshotEmbedding: jest.fn().mockResolvedValue(undefined),
    };

    graphRepository = {
      createDependencyEdges: jest.fn().mockResolvedValue(undefined),
    } as any;
    const persistenceStep = new RunScanJobPersistenceStep(
      prisma,
      artifactRepository,
      graphRepository,
      evidenceRepo,
      scanJobRepository,
    );

    useCase = new RunScanJobUseCase(
      scanJobRepository,
      eventLogService,
      queueService,
      persistenceStep,
    );
  });

  afterAll(() => {
    if (originalPreserveScanWorkspaceEnv === undefined) {
      delete process.env.BA_HELPER_PRESERVE_SCAN_WORKSPACE;
    } else {
      process.env.BA_HELPER_PRESERVE_SCAN_WORKSPACE = originalPreserveScanWorkspaceEnv;
    }
  });

  const mockSuccessfulTypeScriptScan = (params: {
    commitSha?: string;
    tempDir?: string;
    artifacts?: any[];
    dependencyEdges?: any[];
  } = {}) => {
    const tempDir = params.tempDir ?? '/tmp/ba-scan-success';
    (fs.mkdtemp as jest.Mock).mockResolvedValue(tempDir);
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({
      commitSha: params.commitSha ?? '0123456789abcdef0123456789abcdef01234567',
    });
    analyzer.FrameworkDetector.detect.mockResolvedValue({
      isSupported: true,
      language: 'typescript',
      framework: 'nestjs',
    });
    analyzer.RepositoryProfileDetector.detect.mockResolvedValue({
      domain: 'BOOKING',
      language: 'TYPESCRIPT',
      framework: 'NESTJS',
      architectureStyle: 'MODULAR_MONOLITH',
      sourceRoots: ['src'],
      testRoots: ['test'],
      diagnostics: { detectedMarkers: ['NESTJS'], confidence: 0.9 },
      profileVersion: 'repo-profile@0.1.0',
    });
    analyzer.SafeFileEnumerator.mockImplementation(() => ({
      enumerate: jest.fn().mockResolvedValue({
        tsFiles: [],
        allFiles: [],
        diagnostics: [],
        isPartial: false,
      }),
    }));
    analyzer.scanProject.mockReturnValue({
      analyzerVersion: '0.2.0',
      artifacts: params.artifacts ?? [
        {
          stableId: 'api:booking.controller.cancel',
          type: 'API_ROUTE',
          filePath: 'src/booking/booking.controller.ts',
          symbolName: 'BookingController.cancel',
          startLine: 10,
          endLine: 20,
          excerpt: 'cancel() {}',
          contentHash: 'hash-123',
        },
      ],
      dependencyEdges: params.dependencyEdges ?? [],
      coverage: { status: 'READY', skippedSummary: {} },
    });
  };

  it('removes temp workspace after a successful secure clone scan', async () => {
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-success');
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({
      commitSha: '0123456789abcdef0123456789abcdef01234567',
    });
    analyzer.FrameworkDetector.detect.mockResolvedValue({ isSupported: true, language: 'typescript', framework: 'nestjs' });
    analyzer.RepositoryProfileDetector.detect.mockResolvedValue({
      domain: 'BOOKING',
      language: 'TYPESCRIPT',
      framework: 'NESTJS',
      architectureStyle: 'MODULAR_MONOLITH',
      sourceRoots: ['src'],
      testRoots: ['test'],
      diagnostics: { detectedMarkers: ['NESTJS'], confidence: 0.9 },
      profileVersion: 'repo-profile@0.1.0',
    });
    analyzer.SafeFileEnumerator.mockImplementation(() => ({
      enumerate: jest.fn().mockResolvedValue({
        tsFiles: [],
        allFiles: [],
        diagnostics: [],
        isPartial: false,
      }),
    }));
    analyzer.scanProject.mockReturnValue({
      analyzerVersion: '0.1.0',
      artifacts: [
        {
          stableId: 'api:booking.controller.cancel',
          type: 'API_ROUTE',
          filePath: 'src/booking/booking.controller.ts',
          symbolName: 'BookingController.cancel',
          startLine: 10,
          endLine: 20,
          excerpt: 'cancel() {}',
        },
      ],
      coverage: { status: 'READY', skippedFiles: [] },
      sourceRoot: '/tmp/ba-scan-success',
    });

    await useCase.execute({ jobId: 'job-1' });

    expect(prisma.repositoryProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { snapshotId: 'snapshot-1' },
        create: expect.objectContaining({
          domain: 'BOOKING',
          framework: 'NESTJS',
          profileVersion: 'repo-profile@0.1.0',
        }),
      }),
    );
    expect(artifactRepository.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          universalKind: expect.any(String),
        }),
      ]),
      prisma,
    );

    expect(fs.rm).toHaveBeenCalledWith('/tmp/ba-scan-success', {
      recursive: true,
      force: true,
    });
    expect(scanJobRepository.updateState).toHaveBeenLastCalledWith({
      jobId: 'job-1',
      status: ScanJobStatus.COMPLETED,
      stage: ScanJobStage.DONE,
      progress: 100,
    }, prisma);
    expect(eventLogService.recordEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: 'SCAN_COMPLETED',
        payload: expect.objectContaining({
          scanJobId: 'job-1',
          repositoryId: 'repo-1',
          snapshotId: 'snapshot-1',
          previousStatus: 'RUNNING',
          nextStatus: 'COMPLETED',
          indexStatus: 'LEXICAL_READY',
          artifactCount: 1,
        }),
      }),
    );
  });

  it('persists scanner artifacts, evidence, lexical-ready state, and enqueues embedding after commit', async () => {
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-deps');
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({ commitSha: 'new-commit' });
    analyzer.FrameworkDetector.detect.mockResolvedValue({ isSupported: true, language: 'typescript', framework: 'nestjs' });
    analyzer.RepositoryProfileDetector.detect.mockResolvedValue({ domain: 'BOOKING', language: 'TYPESCRIPT', framework: 'NESTJS' });
    analyzer.SafeFileEnumerator.mockImplementation(() => ({
      enumerate: jest.fn().mockResolvedValue({ tsFiles: [], allFiles: [], diagnostics: [], isPartial: false }),
    }));
    
    analyzer.scanProject.mockReturnValue({
      analyzerVersion: '0.2.0',
      artifacts: [
        {
          stableId: 'api:booking.controller.cancel',
          type: 'API_ROUTE',
          filePath: 'src/booking/booking.controller.ts',
          symbolName: 'BookingController.cancel',
          startLine: 10,
          endLine: 20,
          excerpt: 'cancel() {}',
          contentHash: 'hash-123',
        },
      ],
      dependencyEdges: [],
      coverage: { status: 'READY', skippedSummary: {} },
    });

    await useCase.execute({ jobId: 'job-1' });

    // 1. Assert exact domain-critical fields in Artifact persistence
    expect(artifactRepository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        artifactKey: 'api:booking.controller.cancel',
        artifactType: 'API_ROUTE',
        universalKind: expect.any(String),
        filePath: 'src/booking/booking.controller.ts',
        contentHash: 'hash-123',
      })
    ], prisma);

    // 2. Assert exact domain-critical fields in Evidence persistence
    expect(evidenceRepo.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        provenanceKey: 'snapshot:snapshot-1:artifact:api:booking.controller.cancel',
        sourceType: 'CODE',
        sourcePath: 'src/booking/booking.controller.ts',
        isRedacted: false,
      })
    ], prisma);

    // 3. Assert snapshot is marked LEXICAL_READY
    expect(prisma.repositorySnapshot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'snapshot-1' },
        data: expect.objectContaining({ indexStatus: 'LEXICAL_READY' }),
      }),
    );

    // 4. Assert enqueueSnapshotEmbedding is called
    expect(queueService.enqueueSnapshotEmbedding).toHaveBeenCalledWith('snapshot-1');
  });

  it('runs clone and scanner work outside the persistence transaction', async () => {
    const milestones: string[] = [];
    mockSuccessfulTypeScriptScan();
    analyzer.GitRepositoryFetcher.fetch.mockImplementation(async () => {
      milestones.push('clone');
      return { commitSha: 'new-commit' };
    });
    analyzer.scanProject.mockImplementation((input: any) => {
      milestones.push('scan');
      return {
        analyzerVersion: '0.2.0',
        artifacts: [
          {
            stableId: 'api:booking.controller.cancel',
            type: 'API_ROUTE',
            filePath: 'src/booking/booking.controller.ts',
            symbolName: 'BookingController.cancel',
            startLine: 10,
            endLine: 20,
            excerpt: 'cancel() {}',
            contentHash: 'hash-123',
          },
        ],
        dependencyEdges: [],
        coverage: input.coverage,
      };
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => {
      milestones.push('tx:start');
      const result = await callback(prisma);
      milestones.push('tx:commit');
      return result;
    });
    queueService.enqueueSnapshotEmbedding.mockImplementation(async () => {
      milestones.push('enqueue');
    });

    await useCase.execute({ jobId: 'job-1' });

    expect(milestones).toEqual(['clone', 'scan', 'tx:start', 'tx:commit', 'enqueue']);
  });

  it('marks scan completed inside the persistence transaction before embedding enqueue', async () => {
    mockSuccessfulTypeScriptScan();

    await useCase.execute({ jobId: 'job-1' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(scanJobRepository.updateState).toHaveBeenCalledWith({
      jobId: 'job-1',
      status: ScanJobStatus.COMPLETED,
      stage: ScanJobStage.DONE,
      progress: 100,
    }, prisma);
    expect(queueService.enqueueSnapshotEmbedding).toHaveBeenCalledWith('snapshot-1');
  });

  it('does not enqueue embedding when scan persistence transaction fails', async () => {
    mockSuccessfulTypeScriptScan();
    prisma.$transaction.mockRejectedValueOnce(new Error('commit failed'));

    await expect(useCase.execute({ jobId: 'job-1' })).rejects.toThrow('commit failed');

    expect(queueService.enqueueSnapshotEmbedding).not.toHaveBeenCalled();
    expect(eventLogService.recordEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'SCAN_COMPLETED' }),
    );
    const finalState = scanJobRepository.updateState.mock.calls.at(-1)?.[0];
    expect(finalState?.status).toBe(ScanJobStatus.FAILED);
    expect(scanJobRepository.updateDiagnostics).toHaveBeenCalledWith({
      jobId: 'job-1',
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: 'SCAN_FAILED',
          message: 'commit failed',
        }),
      ]),
    });
  });

  it.each([
    {
      label: 'after snapshot upsert before artifact persistence',
      setupFailure: () => {
        artifactRepository.createMany.mockRejectedValueOnce(new Error('artifact create failed'));
      },
      expectedMessage: 'artifact create failed',
    },
    {
      label: 'after artifact persistence before evidence persistence',
      setupFailure: () => {
        graphRepository.createDependencyEdges.mockRejectedValueOnce(new Error('edge create failed'));
      },
      expectedMessage: 'edge create failed',
    },
    {
      label: 'after dependency edge persistence before index publication',
      setupFailure: () => {
        evidenceRepo.upsertMany.mockRejectedValueOnce(new Error('evidence upsert failed'));
      },
      expectedMessage: 'evidence upsert failed',
    },
  ])('keeps scan unpublished when transaction fails $label', async ({ setupFailure, expectedMessage }) => {
    mockSuccessfulTypeScriptScan();
    setupFailure();

    await expect(useCase.execute({ jobId: 'job-1' })).rejects.toThrow(expectedMessage);

    expect(prisma.repositorySnapshot.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ indexStatus: 'LEXICAL_READY' }),
      }),
    );
    expect(queueService.enqueueSnapshotEmbedding).not.toHaveBeenCalled();
    expect(eventLogService.recordEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'SCAN_COMPLETED' }),
    );
    const finalState = scanJobRepository.updateState.mock.calls.at(-1)?.[0];
    expect(finalState?.status).toBe(ScanJobStatus.FAILED);
  });

  it('keeps scan completed and marks vector failed when embedding enqueue fails after commit', async () => {
    mockSuccessfulTypeScriptScan();
    queueService.enqueueSnapshotEmbedding.mockRejectedValueOnce(new Error('redis down'));

    await useCase.execute({ jobId: 'job-1' });

    expect(scanJobRepository.updateState).toHaveBeenCalledWith({
      jobId: 'job-1',
      status: ScanJobStatus.COMPLETED,
      stage: ScanJobStage.DONE,
      progress: 100,
    }, prisma);
    expect(prisma.repositorySnapshot.update).toHaveBeenCalledWith({
      where: { id: 'snapshot-1' },
      data: { indexStatus: 'VECTOR_FAILED' },
    });
    expect(eventLogService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SCAN_COMPLETED',
        payload: expect.objectContaining({
          snapshotId: 'snapshot-1',
          nextStatus: 'COMPLETED',
          indexStatus: 'VECTOR_FAILED',
        }),
      }),
    );
    expect(eventLogService.recordEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'SCAN_FAILED' }),
    );
  });

  it('reruns the same commit through stable snapshot, artifact, edge, evidence, and embedding keys', async () => {
    mockSuccessfulTypeScriptScan({
      commitSha: 'same-commit',
      artifacts: [
        {
          stableId: 'api:booking.controller.cancel',
          type: 'API_ROUTE',
          filePath: 'src/booking/booking.controller.ts',
          symbolName: 'BookingController.cancel',
          startLine: 10,
          endLine: 20,
          excerpt: 'cancel() {}',
          contentHash: 'hash-route',
        },
        {
          stableId: 'service:booking.service.cancelBooking',
          type: 'SERVICE_METHOD',
          filePath: 'src/booking/booking.service.ts',
          symbolName: 'BookingService.cancelBooking',
          startLine: 30,
          endLine: 50,
          excerpt: 'cancelBooking() {}',
          contentHash: 'hash-service',
        },
      ],
      dependencyEdges: [
        {
          fromArtifactId: 'api:booking.controller.cancel',
          toArtifactId: 'service:booking.service.cancelBooking',
          type: 'CALLS',
        },
      ],
    });
    artifactRepository.listBySnapshot.mockResolvedValue([
      {
        id: 'artifact-route',
        artifactKey: 'api:booking.controller.cancel',
      },
      {
        id: 'artifact-service',
        artifactKey: 'service:booking.service.cancelBooking',
      },
    ]);

    await useCase.execute({ jobId: 'job-1' });
    await useCase.execute({ jobId: 'job-1' });

    expect(prisma.repositorySnapshot.upsert).toHaveBeenCalledTimes(2);
    for (const call of prisma.repositorySnapshot.upsert.mock.calls) {
      expect(call[0].where.repositoryId_commitSha_analyzerVersion).toEqual({
        repositoryId: 'repo-1',
        commitSha: 'same-commit',
        analyzerVersion: '0.2.0',
      });
    }
    expect(artifactRepository.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          artifactKey: 'api:booking.controller.cancel',
          contentHash: 'hash-route',
        }),
        expect.objectContaining({
          artifactKey: 'service:booking.service.cancelBooking',
          contentHash: 'hash-service',
        }),
      ]),
      prisma,
    );
    expect(graphRepository.createDependencyEdges).toHaveBeenCalledWith([
      expect.objectContaining({
        snapshotId: 'snapshot-1',
        fromArtifactId: 'artifact-route',
        toArtifactId: 'artifact-service',
        type: 'CALLS',
      }),
    ], prisma);
    expect(evidenceRepo.upsertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          provenanceKey: 'snapshot:snapshot-1:artifact:api:booking.controller.cancel',
          artifactId: 'artifact-route',
        }),
        expect.objectContaining({
          provenanceKey: 'snapshot:snapshot-1:artifact:service:booking.service.cancelBooking',
          artifactId: 'artifact-service',
        }),
      ]),
      prisma,
    );
    expect(queueService.enqueueSnapshotEmbedding).toHaveBeenNthCalledWith(1, 'snapshot-1');
    expect(queueService.enqueueSnapshotEmbedding).toHaveBeenNthCalledWith(2, 'snapshot-1');
  });

  it('removes temp workspace on clone failure without masking the original error', async () => {
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-fail');
    (fs.rm as jest.Mock).mockRejectedValue(new Error('cleanup failed'));
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockRejectedValue(new Error('network down'));
    analyzer.RepositoryProfileDetector.detect.mockResolvedValue({
      domain: 'UNKNOWN',
      language: 'UNKNOWN',
      framework: 'UNKNOWN',
      architectureStyle: 'UNKNOWN',
      sourceRoots: [],
      testRoots: [],
      diagnostics: { confidence: 0.2 },
      profileVersion: 'repo-profile@0.1.0',
    });

    await expect(useCase.execute({ jobId: 'job-1' })).rejects.toMatchObject({
      code: 'CLONE_FAILED',
      message: 'network down',
    } satisfies Partial<AppError>);

    expect(fs.rm).toHaveBeenCalledWith('/tmp/ba-scan-fail', {
      recursive: true,
      force: true,
    });
    expect(scanJobRepository.updateState).toHaveBeenLastCalledWith({
      jobId: 'job-1',
      status: ScanJobStatus.FAILED,
      stage: ScanJobStage.DONE,
      progress: 0,
      errorCode: 'CLONE_FAILED',
      errorMessage: 'network down',
    });
    expect(eventLogService.recordEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: 'SCAN_FAILED',
        payload: expect.objectContaining({
          scanJobId: 'job-1',
          repositoryId: 'repo-1',
          errorCode: 'CLONE_FAILED',
          errorMessage: 'network down',
        }),
      }),
    );
    expect(prisma.repositoryProfile.upsert).not.toHaveBeenCalled();
  });

  it('preserves temp workspace on scan failure when debug preserve mode is enabled', async () => {
    process.env.BA_HELPER_PRESERVE_SCAN_WORKSPACE = '1';
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-debug-preserve');
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockRejectedValue(new Error('network down'));

    await expect(useCase.execute({ jobId: 'job-1' })).rejects.toMatchObject({
      code: 'CLONE_FAILED',
      message: 'network down',
    } satisfies Partial<AppError>);

    expect(fs.rm).not.toHaveBeenCalled();
    expect(scanJobRepository.updateState).toHaveBeenLastCalledWith({
      jobId: 'job-1',
      status: ScanJobStatus.FAILED,
      stage: ScanJobStage.DONE,
      progress: 0,
      errorCode: 'CLONE_FAILED',
      errorMessage: 'network down',
    });
  });

  it('persists INCREMENTAL_SCAN_SUMMARY diagnostic without raw source or hashes', async () => {
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-incremental');
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({ commitSha: 'new-commit' });
    analyzer.FrameworkDetector.detect.mockResolvedValue({ isSupported: true, language: 'typescript', framework: 'nestjs' });
    analyzer.RepositoryProfileDetector.detect.mockResolvedValue({ domain: 'BOOKING', language: 'TYPESCRIPT', framework: 'NESTJS' });
    analyzer.SafeFileEnumerator.mockImplementation(() => ({
      enumerate: jest.fn().mockResolvedValue({ tsFiles: [], allFiles: [], diagnostics: [], isPartial: false }),
    }));
    analyzer.scanProject.mockReturnValue({
      analyzerVersion: '0.2.0',
      artifacts: [{
        stableId: 'api:booking.controller.cancel',
        type: 'API_ROUTE',
        filePath: 'src/booking.ts',
        contentHash: 'hash-abc',
        excerpt: 'cancel() {}'
      }],
      coverage: { status: 'READY', skippedSummary: {} },
    });

    prisma.repositorySnapshot.findFirst.mockResolvedValue({
      id: 'prev-snapshot',
      analyzerVersion: '0.2.0',
    });

    artifactRepository.listBySnapshot.mockResolvedValue([
      { artifactKey: 'api:booking.controller.cancel', contentHash: 'hash-abc', universalKind: 'API_ROUTE', filePath: 'src/booking.ts' },
      { artifactKey: 'api:booking.controller.other', contentHash: 'hash-def', universalKind: 'API_ROUTE', filePath: 'src/other.ts' },
    ]);

    await useCase.execute({ jobId: 'job-1' });

    expect(prisma.repositorySnapshot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              code: 'INCREMENTAL_SCAN_SUMMARY',
              payload: expect.objectContaining({
                baseSnapshotId: 'prev-snapshot',
                addedArtifactCount: 0,
                unchangedArtifactCount: 1,
                removedArtifactCount: 1,
              })
            }),
            expect.objectContaining({
              code: 'EMBEDDING_REUSE_PLAN',
              payload: expect.objectContaining({
                reuseMode: 'PLAN_ONLY',
              })
            })
          ])
        })
      })
    );

    // Verify sample payload does not have raw source or hashes
    const callArgs = prisma.repositorySnapshot.update.mock.calls[0][0];
    const diag = callArgs.data.diagnostics.find((d: any) => d.code === 'INCREMENTAL_SCAN_SUMMARY');
    const removedSample = diag.payload.samples.removed[0];
    
    expect(removedSample).not.toHaveProperty('contentHash');
    expect(removedSample).not.toHaveProperty('excerpt');
  });

  it('persists all four required diagnostics: SCAN_HEALTH, SCANNER_CAPABILITY_SUMMARY, INCREMENTAL_SCAN_SUMMARY, EMBEDDING_REUSE_PLAN', async () => {
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-required-diag');
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({ commitSha: 'req-commit' });
    analyzer.FrameworkDetector.detect.mockResolvedValue({ isSupported: true, language: 'typescript', framework: 'nestjs' });
    analyzer.RepositoryProfileDetector.detect.mockResolvedValue({ domain: 'BOOKING', language: 'TYPESCRIPT', framework: 'NESTJS' });
    analyzer.SafeFileEnumerator.mockImplementation(() => ({
      enumerate: jest.fn().mockResolvedValue({ tsFiles: [], allFiles: [], diagnostics: [], isPartial: false }),
    }));
    analyzer.scanProject.mockReturnValue({
      analyzerVersion: '0.2.0',
      artifacts: [],
      coverage: { status: 'READY', skippedSummary: {} },
    });

    await useCase.execute({ jobId: 'job-1' });

    const updateCall = prisma.repositorySnapshot.update.mock.calls[0][0];
    const diagnosticCodes: string[] = updateCall.data.diagnostics.map((d: any) => d.code);

    expect(diagnosticCodes).toContain('SCAN_HEALTH');
    expect(diagnosticCodes).toContain('SCANNER_CAPABILITY_SUMMARY');
    expect(diagnosticCodes).toContain('INCREMENTAL_SCAN_SUMMARY');
    expect(diagnosticCodes).toContain('EMBEDDING_REUSE_PLAN');
  });

  it('fails with controlled error if unknown language/framework is provided, does not fallback to TypeScript', async () => {
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-unknown-lang');
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({ commitSha: 'unknown-commit' });
    analyzer.FrameworkDetector.detect.mockResolvedValue({ isSupported: true, language: 'python', framework: 'django' });
    
    // Simulate an unsupported language detected
    analyzer.RepositoryProfileDetector.detect.mockResolvedValue({ 
      domain: 'UNKNOWN', 
      language: 'python', 
      framework: 'django',
      architectureStyle: 'UNKNOWN',
      sourceRoots: [],
      testRoots: [],
      profileVersion: 'repo-profile@0.1.0'
    });
    
    analyzer.SafeFileEnumerator.mockImplementation(() => ({
      enumerate: jest.fn().mockResolvedValue({ tsFiles: [], allFiles: [], diagnostics: [], isPartial: false }),
    }));

    await expect(useCase.execute({ jobId: 'job-1' })).rejects.toThrow('No scanner adapter found');

    // Should not call scanProject (TypeScript default)
    expect(analyzer.scanProject).not.toHaveBeenCalled();
    expect(analyzer.scanJavaSpringProject).not.toHaveBeenCalled();

    // Job must be marked FAILED
    const finalState = scanJobRepository.updateState.mock.calls.at(-1)?.[0];
    expect(finalState?.status).toBe(ScanJobStatus.FAILED);
    expect(finalState?.errorCode).toBe('UNSUPPORTED_FRAMEWORK');

    expect(prisma.repositoryTarget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repositoryId_targetKey: {
            repositoryId: 'repo-1',
            targetKey: 'main',
          },
        },
        update: expect.objectContaining({
          latestObservedCommitSha: 'unknown-commit',
        }),
      }),
    );
    expect(prisma.repositorySnapshot.upsert).not.toHaveBeenCalled();
    expect(prisma.scanJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotId: expect.any(String),
          sourceTargetId: expect.any(String),
        }),
      }),
    );
    expect(queueService.enqueueSnapshotEmbedding).not.toHaveBeenCalled();

    // No SCAN_COMPLETED event emitted
    const completedCall = eventLogService.recordEvent.mock.calls.find(
      (c: any[]) => c[0]?.eventType === 'SCAN_COMPLETED',
    );
    expect(completedCall).toBeUndefined();

    // Snapshot is not successfully updated to have LEXICAL_READY or diagnostics
    expect(prisma.repositorySnapshot.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ indexStatus: 'LEXICAL_READY' })
      })
    );
  });

  it('persists Java/Spring SCANNER_CAPABILITY_SUMMARY showing PARTIAL/MEDIUM, without source or vectors', async () => {
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-java-spring');
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({ commitSha: 'java-commit' });
    analyzer.FrameworkDetector.detect.mockResolvedValue({ isSupported: true, language: 'java', framework: 'spring_boot' });
    analyzer.RepositoryProfileDetector.detect.mockResolvedValue({ 
      domain: 'BOOKING', 
      language: 'JAVA', 
      framework: 'SPRING_BOOT',
      architectureStyle: 'MODULAR_MONOLITH',
      sourceRoots: ['src/main/java'],
      testRoots: ['src/test/java'],
      profileVersion: 'repo-profile@0.1.0'
    });
    analyzer.SafeFileEnumerator.mockImplementation(() => ({
      enumerate: jest.fn().mockResolvedValue({ tsFiles: [], javaFiles: ['src/main/java/Controller.java'], allFiles: [], diagnostics: [], isPartial: false }),
    }));
    analyzer.scanJavaSpringProject.mockReturnValue({
      analyzerVersion: '0.2.0',
      artifacts: [],
      coverage: { status: 'PARTIAL', skippedSummary: {} },
    });

    await useCase.execute({ jobId: 'job-1' });

    expect(analyzer.scanJavaSpringProject).toHaveBeenCalled();
    expect(analyzer.scanProject).not.toHaveBeenCalled();

    const updateCall = prisma.repositorySnapshot.update.mock.calls[0][0];
    const capabilityDiag = updateCall.data.diagnostics.find((d: any) => d.code === 'SCANNER_CAPABILITY_SUMMARY');
    
    expect(capabilityDiag).toBeDefined();
    expect(capabilityDiag.payload).toMatchObject({
      language: 'java',
      framework: 'spring',
      status: 'PARTIAL',
      confidence: 'MEDIUM'
    });

    // Ensure it doesn't contain source code, vectors, embeddings, prompt text, or absolute local paths
    const payloadStr = JSON.stringify(capabilityDiag.payload);
    expect(payloadStr).not.toMatch(/sourceCode/i);
    expect(payloadStr).not.toMatch(/vector/i);
    expect(payloadStr).not.toMatch(/embedding/i);
    expect(payloadStr).not.toMatch(/prompt/i);
    expect(payloadStr).not.toMatch(/\/tmp\/ba-scan-java-spring/);
  });

  it('fails the job explicitly when diagnostics update throws — no silent success', async () => {
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-diag-fail');
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({ commitSha: 'diag-fail-commit' });
    analyzer.FrameworkDetector.detect.mockResolvedValue({ isSupported: true, language: 'typescript', framework: 'nestjs' });
    analyzer.RepositoryProfileDetector.detect.mockResolvedValue({ domain: 'BOOKING', language: 'TYPESCRIPT', framework: 'NESTJS' });
    analyzer.SafeFileEnumerator.mockImplementation(() => ({
      enumerate: jest.fn().mockResolvedValue({ tsFiles: [], allFiles: [], diagnostics: [], isPartial: false }),
    }));
    analyzer.scanProject.mockReturnValue({
      analyzerVersion: '0.2.0',
      artifacts: [],
      coverage: { status: 'READY', skippedSummary: {} },
    });

    // Simulate DB failure when persisting final diagnostics
    prisma.repositorySnapshot.update.mockRejectedValueOnce(new Error('db connection lost'));

    await expect(useCase.execute({ jobId: 'job-1' })).rejects.toThrow('db connection lost');

    // Job must be marked FAILED — not COMPLETED
    const finalState = scanJobRepository.updateState.mock.calls.at(-1)?.[0];
    expect(finalState?.status).toBe(ScanJobStatus.FAILED);
    expect(queueService.enqueueSnapshotEmbedding).not.toHaveBeenCalled();

    // No SCAN_COMPLETED event should have been emitted
    const completedCall = eventLogService.recordEvent.mock.calls.find(
      (c: any[]) => c[0]?.eventType === 'SCAN_COMPLETED',
    );
    expect(completedCall).toBeUndefined();
  });
});
