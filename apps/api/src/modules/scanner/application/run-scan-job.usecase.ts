import { Injectable, Logger } from '@nestjs/common';
import { ScanJobRepository } from '../infrastructure/scan-job.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';
import { ScanJobStatus, ScanJobStage } from '@prisma/client';
import { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { normalizeArtifactKind } from '../../artifact/domain/universal-artifact-kind';
import { 
  scanFixture, 
  scanProject, 
  FrameworkDetector, 
  RepositoryProfileDetector,
  SafeFileEnumerator, 
  SecretRedactor,
  DiagnosticCollector,
  scanJavaSpringProject,
  GitHubUrlValidator,
  GitRepositoryFetcher
} from '@ba-helper/analyzer';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { EvidenceRepository } from '../../evidence/infrastructure/evidence.repository';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DetectedRepositoryProfile, ScanArtifact, ScanResult } from '@ba-helper/analyzer';
import type { DiagnosticItem } from '@ba-helper/contracts';
import { summarizeDiagnostics } from './scan-diagnostic-summary';
import { IncrementalScanClassifier } from './incremental-scan-classifier';

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

@Injectable()
export class RunScanJobUseCase {
  private readonly logger = new Logger(RunScanJobUseCase.name);

  constructor(
    private readonly scanJobRepository: ScanJobRepository,
    private readonly artifactRepository: ArtifactRepository,
    private readonly eventLogService: EventLogService,
    private readonly evidenceRepo: EvidenceRepository,
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
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

    let cleanupDir: string | undefined;
    const collector = new DiagnosticCollector();
    let commitSha: string | null = null;
    let currentStage: ScanJobStage = ScanJobStage.EXTRACTING_ARTIFACTS;

    try {
      let scanResult: ScanResult;
      let repositoryProfile: DetectedRepositoryProfile | null = null;
      let coverageStatus: 'READY' | 'PARTIAL' = 'READY';
      
      const sourceRoot = job.repository.canonicalUrl;
      const urlValidation = GitHubUrlValidator.validate(sourceRoot);

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
          frameworkHint: frameworkResult.framework,
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

        const scanCoverage: import('@ba-helper/analyzer').ScanCoverage = {
          status: enumResult.isPartial ? 'PARTIAL' : 'FULL',
          skippedFiles: enumResult.skippedFiles,
          skippedSummary: enumResult.skippedSummary,
          limits: enumResult.limits,
          limitHits: enumResult.limitHits,
        };

        currentStage = ScanJobStage.EXTRACTING_ARTIFACTS;
        
        if (repositoryProfile?.framework === 'SPRING_BOOT') {
          scanResult = await scanJavaSpringProject({
            fixturePath: tempDir,
            analyzerVersion: '0.1.0',
            javaFiles: enumResult.javaFiles,
            coverage: scanCoverage,
          });
          collector.add({
            code: 'SPRING_BOOT_PILOT_ADAPTER',
            severity: 'WARN',
            message: 'Spring Boot pilot adapter uses lightweight annotation extraction only.',
            category: 'FRAMEWORK',
          });
        } else {
          scanResult = scanProject({
            fixturePath: tempDir,
            analyzerVersion: '0.2.0',
            tsFiles: enumResult.tsFiles,
            coverage: scanCoverage,
          });
        }
      } else {
        commitSha = 'mock-commit-sha';
        scanResult = scanFixture({
          fixturePath: sourceRoot,
          analyzerVersion: '0.2.0',
        });
      }

      // FULL maps to READY because Prisma enum predates scan-health terminology.
      // FAILED does not create RepositorySnapshot.
      coverageStatus = scanResult.coverage.status === 'FULL' ? 'READY' : 'PARTIAL';

      if (!commitSha) {
        throw new Error('Commit SHA was not resolved for scan job.');
      }

      // Record detailed scan health into snapshot diagnostics
      const scanHealth: import('@ba-helper/analyzer').ScanHealthDiagnostics = {
        coverageStatus: scanResult.coverage.status,
        scannerVersion: 'scanner@0.2.0',
        analyzerVersion: scanResult.analyzerVersion,
        scannedFileCount: scanResult.artifacts.length, // approximation or use enumResult if possible
        skippedFileCount: Object.values(scanResult.coverage.skippedSummary).reduce((a, b) => a + b, 0),
        artifactCount: scanResult.artifacts.length,
        skippedSummary: scanResult.coverage.skippedSummary,
        skippedFilesSample: scanResult.coverage.skippedFiles,
        limits: scanResult.coverage.limits,
        limitHits: scanResult.coverage.limitHits,
      };

      collector.add({
        code: 'SCAN_HEALTH',
        severity: 'INFO',
        message: 'Scan health summary generated',
        category: 'SCANNER',
        payload: scanHealth as unknown as Record<string, unknown>,
      });

      const previousSnapshot = await this.prisma.repositorySnapshot.findFirst({
        where: {
          repositoryId: job.repositoryId,
          coverageStatus: { in: ['READY', 'PARTIAL'] },
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      });
      
      const previousArtifacts = previousSnapshot ? await this.artifactRepository.listBySnapshot(previousSnapshot.id) : [];

      const incrementalSummary = IncrementalScanClassifier.classify({
        currentArtifacts: scanResult.artifacts,
        currentAnalyzerVersion: scanResult.analyzerVersion,
        previousSnapshot: previousSnapshot ? { id: previousSnapshot.id, analyzerVersion: previousSnapshot.analyzerVersion } : null,
        previousArtifacts,
      });

      collector.add({
        code: 'INCREMENTAL_SCAN_SUMMARY',
        severity: 'INFO',
        message: 'Incremental scan classification summary generated',
        category: 'SCANNER',
        payload: incrementalSummary as unknown as Record<string, unknown>,
      });

      const target = await this.prisma.repositoryTarget.upsert({
        where: {
          repositoryId_targetKey: {
            repositoryId: job.repositoryId,
            targetKey: job.requestedRef ?? 'main',
          },
        },
        create: {
          repositoryId: job.repositoryId,
          targetKey: job.requestedRef ?? 'main',
          requestedRef: job.requestedRef ?? 'main',
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: commitSha,
          lastObservedAt: new Date(),
        },
        update: {
          latestObservedCommitSha: commitSha,
          lastObservedAt: new Date(),
        },
      });

      const snapshot = await this.prisma.repositorySnapshot.upsert({
        where: {
          repositoryId_commitSha_analyzerVersion: {
            repositoryId: job.repositoryId,
            commitSha: commitSha,
            analyzerVersion: scanResult.analyzerVersion,
          },
        },
        create: {
          repositoryId: job.repositoryId,
          commitSha: commitSha,
          analyzerVersion: scanResult.analyzerVersion,
          coverageStatus: coverageStatus,
          diagnostics: collector.getItems() as unknown as import('@prisma/client').Prisma.InputJsonValue,
        },
        update: {
          coverageStatus: coverageStatus,
          diagnostics: collector.getItems() as unknown as import('@prisma/client').Prisma.InputJsonValue,
        },
      });

      if (repositoryProfile) {
        await this.prisma.repositoryProfile.upsert({
          where: { snapshotId: snapshot.id },
          create: {
            snapshotId: snapshot.id,
            domain: repositoryProfile.domain,
            language: repositoryProfile.language,
            framework: repositoryProfile.framework,
            architectureStyle: repositoryProfile.architectureStyle,
            sourceRoots:
              repositoryProfile.sourceRoots as unknown as import('@prisma/client').Prisma.InputJsonValue,
            testRoots:
              repositoryProfile.testRoots as unknown as import('@prisma/client').Prisma.InputJsonValue,
            diagnostics: repositoryProfile.diagnostics
              ? (repositoryProfile.diagnostics as unknown as import('@prisma/client').Prisma.InputJsonValue)
              : undefined,
            profileVersion: repositoryProfile.profileVersion,
          },
          update: {
            domain: repositoryProfile.domain,
            language: repositoryProfile.language,
            framework: repositoryProfile.framework,
            architectureStyle: repositoryProfile.architectureStyle,
            sourceRoots:
              repositoryProfile.sourceRoots as unknown as import('@prisma/client').Prisma.InputJsonValue,
            testRoots:
              repositoryProfile.testRoots as unknown as import('@prisma/client').Prisma.InputJsonValue,
            diagnostics: repositoryProfile.diagnostics
              ? (repositoryProfile.diagnostics as unknown as import('@prisma/client').Prisma.InputJsonValue)
              : undefined,
            profileVersion: repositoryProfile.profileVersion,
          },
        });
      }

      await this.scanJobRepository.updateState({
        jobId: job.id,
        status: ScanJobStatus.RUNNING,
        stage: ScanJobStage.EXTRACTING_ARTIFACTS,
        progress: 50,
      });

      await this.prisma.scanJob.update({
        where: { id: job.id },
        data: { snapshotId: snapshot.id, sourceTargetId: target.id },
      });

      if (scanResult.artifacts.length > 0) {
        // Wait until artifacts are created first since evidence needs artifact references
        await this.artifactRepository.createMany(
          scanResult.artifacts.map((artifact: ScanArtifact) => ({
            snapshotId: snapshot.id,
            artifactKey: artifact.stableId,
            artifactType: artifact.type,
            universalKind: normalizeArtifactKind(artifact.type),
            name: artifact.symbolName,
            filePath: artifact.filePath,
            startLine: artifact.startLine,
            endLine: artifact.endLine,
            contentHash: artifact.contentHash,
          })),
        );

        // Fetch back artifacts to insert their excerpts into Evidence
        const persistedArtifacts = await this.artifactRepository.listBySnapshot(snapshot.id);
        const evidenceInputs = scanResult.artifacts.map((artifact: ScanArtifact) => {
            const persistedId = persistedArtifacts.find((persistedArtifact: { artifactKey: string; id: string }) => persistedArtifact.artifactKey === artifact.stableId)?.id;
            if (!persistedId) return null;
            
            let excerpt = artifact.excerpt || '';
            const redaction = SecretRedactor.redact(excerpt);
            excerpt = redaction.redactedContent;
            
            const contentHash = createHash('sha256').update(excerpt).digest('hex');

            return {
                provenanceKey: `snapshot:${snapshot.id}:artifact:${artifact.stableId}`,
                sourceType: artifact.type === 'TEST' ? 'TEST' : 'CODE',
                snapshotId: snapshot.id,
                artifactId: persistedId,
                sourcePath: artifact.filePath,
                startLine: artifact.startLine,
                endLine: artifact.endLine,
                excerpt,
                contentHash,
                isRedacted: redaction.foundSecrets,
                redactionMetadata: null,
            };
        }).filter((e): e is NonNullable<typeof e> => e !== null);
        
        if (evidenceInputs.some(e => e.isRedacted)) {
            collector.addSecretRedacted('source files');
            await this.prisma.repositorySnapshot.update({
              where: { id: snapshot.id },
              data: { diagnostics: collector.getItems() as unknown as import('@prisma/client').Prisma.InputJsonValue },
            });
        }

        await this.evidenceRepo.upsertMany(evidenceInputs);

        // Snapshot is now LEXICAL_READY, enqueue for embedding
        await this.prisma.repositorySnapshot.update({
          where: { id: snapshot.id },
          data: { indexStatus: 'LEXICAL_READY' },
        });
        await this.queueService.enqueueSnapshotEmbedding(snapshot.id);
      }
      await this.scanJobRepository.updateState({
        jobId: job.id,
        status: ScanJobStatus.COMPLETED,
        stage: ScanJobStage.DONE,
        progress: 100,
      });

      await this.eventLogService.recordEvent({
        eventType: 'SCAN_JOB_COMPLETED',
        idempotencyKey: `scan-job:${job.id}:completed`,
        payload: {
          jobId: job.id,
          repositoryId: job.repositoryId,
          requestedRef: job.requestedRef ?? 'main',
          sourceTargetId: target.id,
          snapshotId: snapshot.id,
          commitSha,
          analyzerVersion: scanResult.analyzerVersion,
          coverageStatus,
          diagnostics: summarizeDiagnostics(collector.getItems() as DiagnosticItem[]),
        },
      });
      this.logger.log(
        JSON.stringify({
          event: 'SCAN_JOB_COMPLETED',
          jobId: job.id,
          repositoryId: job.repositoryId,
          requestedRef: job.requestedRef ?? 'main',
          sourceTargetId: target.id,
          snapshotId: snapshot.id,
          commitSha,
          coverageStatus,
          diagnostics: summarizeDiagnostics(collector.getItems() as DiagnosticItem[]),
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
        await this.prisma.scanJob.update({
          where: { id: job.id },
          data: { diagnostics: collector.getItems() as unknown as import('@prisma/client').Prisma.InputJsonValue },
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
          eventType: 'SCAN_JOB_FAILED',
          idempotencyKey: `scan-job:${job.id}:failed`,
          payload: {
            jobId: job.id,
            repositoryId: job.repositoryId,
            requestedRef: job.requestedRef ?? 'main',
            stage: currentStage,
            commitSha,
            errorCode,
            errorMessage: errorMsg,
            diagnostics: summarizeDiagnostics(collector.getItems() as DiagnosticItem[]),
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
