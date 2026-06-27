import { Injectable, Logger } from '@nestjs/common';
import { ScanJobRepository } from '../infrastructure/scan-job.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '@ba-helper/shared';
import { ScanJobStatus, ScanJobStage } from '@prisma/client';
import { 
  scanFixture, 
  FrameworkDetector, 
  RepositoryProfileDetector,
  SafeFileEnumerator, 
  DiagnosticCollector,
  GitHubUrlValidator,
  GitRepositoryFetcher,
  ScannerAdapterRegistry,
} from '@ba-helper/analyzer';
import { QueueService } from '../../queue/queue.service';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  DetectedRepositoryProfile,
  ScanCoverage,
  ScanResult,
} from '@ba-helper/analyzer';
import type { DiagnosticItem } from '@ba-helper/contracts';
import { summarizeDiagnostics } from './scan-diagnostic-summary';
import { RunScanJobPersistenceStep } from './run-scan-job-persistence.step';

const safeRm = async (targetDir?: string): Promise<void> => {
  if (!targetDir) {
    return;
  }

  try {
    await fs.rm(targetDir, { recursive: true, force: true });
  } catch {
    // Cleanup failure must not mask the original scan error.
  }
};

const toProfileFrameworkHint = (framework?: string): DetectedRepositoryProfile['framework'] | undefined => {
  if (framework === 'nestjs') return 'NESTJS';
  if (framework === 'spring_boot') return 'SPRING_BOOT';
  if (framework === 'generic_typescript') return 'GENERIC_TYPESCRIPT';
  if (framework === 'net/http') return 'NET_HTTP';
  if (framework === 'gin') return 'GIN';
  if (framework === 'fastapi') return 'FASTAPI';
  if (framework === 'aspnetcore') return 'ASPNETCORE';
  if (framework === 'laravel') return 'LARAVEL';
  if (framework === 'rails') return 'RAILS';
  return undefined;
};

const toProfileLanguageHint = (language?: string): DetectedRepositoryProfile['language'] | undefined => {
  if (language === 'typescript') return 'TYPESCRIPT';
  if (language === 'java') return 'JAVA';
  if (language === 'go') return 'GO';
  if (language === 'python') return 'PYTHON';
  if (language === 'csharp') return 'CSHARP';
  if (language === 'php') return 'PHP';
  if (language === 'ruby') return 'RUBY';
  return undefined;
};

@Injectable()
export class RunScanJobUseCase {
  private readonly logger = new Logger(RunScanJobUseCase.name);

  private readonly scannerAdapterRegistry = new ScannerAdapterRegistry();

  constructor(
    private readonly scanJobRepository: ScanJobRepository,
    private readonly eventLogService: EventLogService,
    private readonly queueService: QueueService,
    private readonly persistenceStep: RunScanJobPersistenceStep,
  ) {}

  async execute(params: { jobId: string }): Promise<void> {
    const job = await this.scanJobRepository.findById(params.jobId);
    if (!job) {
      throw new AppError('SCAN_JOB_NOT_FOUND', 'Scan job not found.');
    }

    if (job.status !== 'QUEUED') {
      throw new AppError('INVALID_SCAN_JOB_STATE', 'Job is not queued.');
    }

    await this.scanJobRepository.updateState({
      jobId: job.id,
      status: ScanJobStatus.RUNNING,
      stage: ScanJobStage.EXTRACTING_ARTIFACTS,
      progress: 10,
    });

    await this.eventLogService.recordEvent({
      eventType: 'SCAN_STARTED',
      idempotencyKey: `scan-job:${job.id}:started`,
      actorUserId: 'system',
      payload: {
        actorType: 'SYSTEM',
        actorId: 'system',
        actorName: 'BA Helper Worker',
        scanJobId: job.id,
        repositoryId: job.repositoryId,
        previousStatus: 'QUEUED',
        nextStatus: 'RUNNING',
      },
    });

    let cleanupDir: string | undefined;
    const collector = new DiagnosticCollector();
    let commitSha: string | null = null;
    let currentStage: ScanJobStage = ScanJobStage.EXTRACTING_ARTIFACTS;

    try {
      let scanResult: ScanResult;
      let repositoryProfile: DetectedRepositoryProfile | null = null;
      
      const sourceRoot = job.repository.canonicalUrl;
      const isLocalFixtureSource =
        process.env.NODE_ENV === 'test' && (sourceRoot.startsWith('/') || sourceRoot.startsWith('file://'));
      const urlValidation = isLocalFixtureSource
        ? { isValid: true }
        : GitHubUrlValidator.validate(sourceRoot);

      if (urlValidation.isValid) {
        currentStage = ScanJobStage.CLONING_REPO;
        await this.scanJobRepository.updateState({
          jobId: job.id,
          status: ScanJobStatus.RUNNING,
          stage: currentStage,
          progress: 15,
        });
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ba-scan-'));
        cleanupDir = tempDir;

        try {
          const fetchResult = await GitRepositoryFetcher.fetch({
            url: sourceRoot,
            targetDir: tempDir,
            ref: job.requestedRef ?? undefined,
          });
          commitSha = fetchResult.commitSha;
        } catch (err) {
          throw new AppError('CLONE_FAILED', (err as Error).message);
        }

        currentStage = ScanJobStage.DETECTING_PROJECT;
        await this.scanJobRepository.updateState({
          jobId: job.id,
          status: ScanJobStatus.RUNNING,
          stage: currentStage,
          progress: 25,
        });
        const frameworkResult = await FrameworkDetector.detect(tempDir);
        repositoryProfile = await RepositoryProfileDetector.detect({
          rootDir: tempDir,
          languageHint: toProfileLanguageHint(frameworkResult.language),
          frameworkHint: toProfileFrameworkHint(frameworkResult.framework),
          unsupportedReason: frameworkResult.isSupported ? undefined : frameworkResult.reason,
        });
        if (!frameworkResult.isSupported) {
          collector.add({
            code: 'UNSUPPORTED_FRAMEWORK',
            severity: 'BLOCKER',
            message: frameworkResult.reason || 'Not a NestJS repository',
            category: 'FRAMEWORK',
          });
          throw new AppError('UNSUPPORTED_FRAMEWORK', frameworkResult.reason || 'Not a NestJS repository');
        }

        currentStage = ScanJobStage.FILTERING_FILES;
        await this.scanJobRepository.updateState({
          jobId: job.id,
          status: ScanJobStatus.RUNNING,
          stage: currentStage,
          progress: 35,
        });
        const enumerator = new SafeFileEnumerator(tempDir);
        const enumResult = await enumerator.enumerate();
        
        for (const d of enumResult.diagnostics) {
          collector.addFromFileDiagnostic(d, d.filePath ? path.relative(tempDir, d.filePath) : undefined);
        }

        const scanCoverage: ScanCoverage = {
          status: enumResult.isPartial ? 'PARTIAL' : 'FULL',
          skippedFiles: enumResult.skippedFiles,
          skippedSummary: enumResult.skippedSummary,
          limits: enumResult.limits,
          limitHits: enumResult.limitHits,
        };

        currentStage = ScanJobStage.EXTRACTING_ARTIFACTS;
        
        let adapter;
        try {
          adapter = this.scannerAdapterRegistry.getAdapter(
            frameworkResult?.language || 'UNKNOWN',
            frameworkResult?.framework || 'UNKNOWN'
          );
        } catch (e) {
          collector.add({
            code: 'UNSUPPORTED_SCANNER_ADAPTER',
            severity: 'BLOCKER',
            message: e instanceof Error ? e.message : 'No scanner adapter found',
            category: 'SCANNER',
          });
          throw new AppError('UNSUPPORTED_FRAMEWORK', e instanceof Error ? e.message : 'No scanner adapter found');
        }

        const adapterResult = await adapter.scan({
          rootDir: tempDir,
          repositoryId: job.repositoryId,
          projectId: job.repository.projectId,
          fixturePath: tempDir,
          tsFiles: enumResult.tsFiles,
          javaFiles: enumResult.javaFiles,
          goFiles: enumResult.goFiles,
          pyFiles: enumResult.pyFiles,
          csFiles: enumResult.csFiles,
          phpFiles: enumResult.phpFiles,
          rbFiles: enumResult.rbFiles,
          coverage: scanCoverage,
        });

        scanResult = {
          analyzerVersion: adapter.adapterVersion,
          artifacts: adapterResult.artifacts,
          dependencyEdges: adapterResult.dependencyEdges,
          coverage: scanCoverage,
          sourceRoot: tempDir,
        };

        for (const diagnostic of adapterResult.diagnostics) {
          collector.add(diagnostic);
        }
      } else {
        commitSha = 'mock-commit-sha';
        scanResult = scanFixture({
          fixturePath: sourceRoot,
          analyzerVersion: '0.2.0',
        });
        collector.add({
          code: 'SCANNER_CAPABILITY_SUMMARY',
          severity: 'INFO',
          message: 'Fixture scanner capability summary',
          category: 'SCANNER',
          payload: {
            features: {
              routes: 'FULL',
              services: 'FULL',
              dataModels: 'FULL',
              events: 'NONE',
            },
          },
        });
      }

      if (!commitSha) {
        throw new Error('Commit SHA was not resolved for scan job.');
      }

      await this.scanJobRepository.updateState({
        jobId: job.id,
        status: ScanJobStatus.RUNNING,
        stage: ScanJobStage.EXTRACTING_ARTIFACTS,
        progress: 50,
      });

      const persisted = await this.persistenceStep.persist({
        job: {
          id: job.id,
          repositoryId: job.repositoryId,
          requestedRef: job.requestedRef,
        },
        commitSha,
        scanResult,
        repositoryProfile,
        collector,
      });

      if (persisted.artifactCount > 0) {
        await this.eventLogService.recordEvent({
          eventType: 'SCAN_ARTIFACTS_EXTRACTED',
          idempotencyKey: `scan-job:${job.id}:artifacts-extracted`,
          actorUserId: 'system',
          payload: {
            actorType: 'SYSTEM',
            actorId: 'system',
            actorName: 'BA Helper Worker',
            scanJobId: job.id,
            repositoryId: job.repositoryId,
            snapshotId: persisted.snapshotId,
            artifactCount: persisted.artifactCount,
          },
        });

        await this.eventLogService.recordEvent({
          eventType: 'SCAN_DEPENDENCY_EDGES_PERSISTED',
          idempotencyKey: `scan-job:${job.id}:edges-persisted`,
          actorUserId: 'system',
          payload: {
            actorType: 'SYSTEM',
            actorId: 'system',
            actorName: 'BA Helper Worker',
            scanJobId: job.id,
            repositoryId: job.repositoryId,
            snapshotId: persisted.snapshotId,
            dependencyEdgeCount: persisted.dependencyEdgeCount,
            skippedEdgeCount: persisted.skippedDependencyEdgeCount,
          },
        });
      }

      if (persisted.shouldEnqueueEmbedding) {
        await this.queueService.enqueueSnapshotEmbedding(persisted.snapshotId);
      }

      await this.eventLogService.recordEvent({
        eventType: 'SCAN_COMPLETED',
        idempotencyKey: `scan-job:${job.id}:completed`,
        actorUserId: 'system',
        payload: {
          actorType: 'SYSTEM',
          actorId: 'system',
          actorName: 'BA Helper Worker',
          scanJobId: job.id,
          repositoryId: job.repositoryId,
          snapshotId: persisted.snapshotId,
          previousStatus: 'RUNNING',
          nextStatus: 'COMPLETED',
          indexStatus: 'LEXICAL_READY',
          artifactCount: persisted.artifactCount,
        },
      });
      this.logger.log(
        JSON.stringify({
          event: 'SCAN_JOB_COMPLETED',
          jobId: job.id,
          repositoryId: job.repositoryId,
          requestedRef: job.requestedRef ?? 'main',
          sourceTargetId: persisted.sourceTargetId,
          snapshotId: persisted.snapshotId,
          commitSha,
          coverageStatus: persisted.coverageStatus,
          diagnostics: summarizeDiagnostics(persisted.diagnostics),
        }),
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof AppError ? error.code : null;
      if (error instanceof AppError && error.code === 'UNSUPPORTED_FRAMEWORK') {
        // Blocker diagnostic already collected above
      } else {
        collector.add({
          code: 'SCAN_FAILED',
          severity: 'BLOCKER',
          message: errorMsg,
          category: 'SCANNER'
        });
      }

      try {
        await this.scanJobRepository.updateState({
          jobId: job.id,
          status: ScanJobStatus.FAILED,
          stage: ScanJobStage.DONE,
          progress: 0,
          errorCode,
          errorMessage: errorMsg,
        });
      } catch (persistError) {
        this.logger.warn(
          JSON.stringify({
            event: 'SCAN_JOB_FAILURE_STATE_PERSIST_FAILED',
            jobId: job.id,
            repositoryId: job.repositoryId,
            originalErrorCode: errorCode,
            originalErrorMessage: errorMsg,
            persistenceError:
              persistError instanceof Error ? persistError.message : 'Unknown persistence error',
          }),
        );
      }

      try {
        await this.scanJobRepository.updateDiagnostics({
          jobId: job.id,
          diagnostics: collector.getItems(),
        });
      } catch (persistError) {
        this.logger.warn(
          JSON.stringify({
            event: 'SCAN_JOB_FAILURE_DIAGNOSTICS_PERSIST_FAILED',
            jobId: job.id,
            repositoryId: job.repositoryId,
            originalErrorCode: errorCode,
            originalErrorMessage: errorMsg,
            persistenceError:
              persistError instanceof Error ? persistError.message : 'Unknown persistence error',
          }),
        );
      }

      try {
        await this.eventLogService.recordEvent({
          eventType: 'SCAN_FAILED',
          idempotencyKey: `scan-job:${job.id}:failed`,
          actorUserId: 'system',
          payload: {
            actorType: 'SYSTEM',
            actorId: 'system',
            actorName: 'BA Helper Worker',
            scanJobId: job.id,
            repositoryId: job.repositoryId,
            previousStatus: 'RUNNING',
            nextStatus: 'FAILED',
            errorCode,
            errorMessage: errorMsg,
          },
        });
      } catch (persistError) {
        this.logger.warn(
          JSON.stringify({
            event: 'SCAN_JOB_FAILURE_EVENT_PERSIST_FAILED',
            jobId: job.id,
            repositoryId: job.repositoryId,
            originalErrorCode: errorCode,
            originalErrorMessage: errorMsg,
            persistenceError:
              persistError instanceof Error ? persistError.message : 'Unknown persistence error',
          }),
        );
      }
      this.logger.error(
        JSON.stringify({
          event: 'SCAN_JOB_FAILED',
          jobId: job.id,
          repositoryId: job.repositoryId,
          requestedRef: job.requestedRef ?? 'main',
          stage: currentStage,
          commitSha,
          errorCode,
          errorMessage: errorMsg,
          diagnostics: summarizeDiagnostics(collector.getItems() as DiagnosticItem[]),
        }),
      );
      throw error;
    } finally {
      await safeRm(cleanupDir);
    }
  }
}
