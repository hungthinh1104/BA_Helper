import { AppError } from '../../../shared/app-error';
import { RunScanJobUseCase } from './run-scan-job.usecase';
import * as fs from 'node:fs/promises';
import { ScanJobStage, ScanJobStatus } from '@prisma/client';

jest.mock('node:fs/promises', () => ({
  mkdtemp: jest.fn(),
  rm: jest.fn(),
}));

jest.mock('@ba-helper/analyzer', () => ({
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
  scanFixture: jest.fn(),
}));

const analyzer = jest.requireMock('@ba-helper/analyzer') as {
  GitHubUrlValidator: { validate: jest.Mock };
  GitRepositoryFetcher: { fetch: jest.Mock };
  FrameworkDetector: { detect: jest.Mock };
  RepositoryProfileDetector: { detect: jest.Mock };
  SafeFileEnumerator: jest.Mock;
  scanProject: jest.Mock;
};

describe('RunScanJobUseCase', () => {
  let useCase: RunScanJobUseCase;
  let scanJobRepository: any;
  let artifactRepository: any;
  let eventLogService: any;
  let evidenceRepo: any;
  let prisma: any;
  let queueService: any;

  beforeEach(() => {
    jest.resetAllMocks();
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

    queueService = {
      enqueueSnapshotEmbedding: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new RunScanJobUseCase(
      scanJobRepository,
      artifactRepository,
      eventLogService,
      evidenceRepo,
      prisma,
      queueService,
    );
  });

  it('removes temp workspace after a successful secure clone scan', async () => {
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-success');
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({
      commitSha: '0123456789abcdef0123456789abcdef01234567',
    });
    analyzer.FrameworkDetector.detect.mockResolvedValue({ isSupported: true });
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
    });
    expect(eventLogService.recordEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: 'SCAN_JOB_COMPLETED',
        payload: expect.objectContaining({
          jobId: 'job-1',
          repositoryId: 'repo-1',
          commitSha: '0123456789abcdef0123456789abcdef01234567',
          diagnostics: expect.objectContaining({
            total: 0,
            bySeverity: { BLOCKER: 0, ERROR: 0, WARN: 0, INFO: 0 },
          }),
        }),
      }),
    );
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
        eventType: 'SCAN_JOB_FAILED',
        payload: expect.objectContaining({
          jobId: 'job-1',
          repositoryId: 'repo-1',
          errorCode: 'CLONE_FAILED',
          errorMessage: 'network down',
        }),
      }),
    );
    expect(prisma.repositoryProfile.upsert).not.toHaveBeenCalled();
  });

  it('persists INCREMENTAL_SCAN_SUMMARY diagnostic without raw source or hashes', async () => {
    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ba-scan-incremental');
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    analyzer.GitHubUrlValidator.validate.mockReturnValue({ isValid: true });
    analyzer.GitRepositoryFetcher.fetch.mockResolvedValue({ commitSha: 'new-commit' });
    analyzer.FrameworkDetector.detect.mockResolvedValue({ isSupported: true });
    analyzer.RepositoryProfileDetector.detect.mockResolvedValue({ domain: 'BOOKING', framework: 'NESTJS' });
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

    expect(prisma.repositorySnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              code: 'INCREMENTAL_SCAN_SUMMARY',
              payload: expect.objectContaining({
                baseSnapshotId: 'prev-snapshot',
                addedArtifactCount: 0,
                unchangedArtifactCount: 1,
                removedArtifactCount: 1,
              })
            })
          ])
        })
      })
    );

    // Verify sample payload does not have raw source or hashes
    const callArgs = prisma.repositorySnapshot.upsert.mock.calls[0][0];
    const diag = callArgs.create.diagnostics.find((d: any) => d.code === 'INCREMENTAL_SCAN_SUMMARY');
    const removedSample = diag.payload.samples.removed[0];
    
    expect(removedSample).not.toHaveProperty('contentHash');
    expect(removedSample).not.toHaveProperty('excerpt');
  });
});
