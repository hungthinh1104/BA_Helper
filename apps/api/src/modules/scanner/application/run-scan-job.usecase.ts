import { Injectable } from '@nestjs/common';
import { ScanJobRepository } from '../infrastructure/scan-job.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';
import { ScanJobStatus, ScanJobStage } from '@prisma/client';
import { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { scanFixture } from '@ba-helper/analyzer';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { EvidenceRepository } from '../../evidence/infrastructure/evidence.repository';
import { createHash } from 'node:crypto';

@Injectable()
export class RunScanJobUseCase {
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

    try {
      const scanResult = scanFixture({
        fixturePath: job.repository.canonicalUrl,
        analyzerVersion: '0.1.0',
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
          latestObservedCommitSha: 'mock-commit-sha', // TODO: actual
          lastObservedAt: new Date(),
        },
        update: {
          latestObservedCommitSha: 'mock-commit-sha',
          lastObservedAt: new Date(),
        },
      });

      const snapshot = await this.prisma.repositorySnapshot.upsert({
        where: {
          repositoryId_commitSha_analyzerVersion: {
            repositoryId: job.repositoryId,
            commitSha: 'mock-commit-sha', // TODO: Get actual commit SHA
            analyzerVersion: scanResult.analyzerVersion,
          },
        },
        create: {
          repositoryId: job.repositoryId,
          commitSha: 'mock-commit-sha', // TODO: Get actual commit SHA
          analyzerVersion: scanResult.analyzerVersion,
          coverageStatus: scanResult.coverage.status,
        },
        update: {
          coverageStatus: scanResult.coverage.status,
        },
      });

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
        const createdArtifacts = await this.artifactRepository.createMany(
          scanResult.artifacts.map((artifact) => ({
            snapshotId: snapshot.id,
            artifactKey: artifact.stableId,
            artifactType: artifact.type,
            name: artifact.symbolName,
            filePath: artifact.filePath,
            startLine: artifact.startLine,
            endLine: artifact.endLine,
          })),
        );

        // Fetch back artifacts to insert their excerpts into Evidence
        const persistedArtifacts = await this.artifactRepository.listBySnapshot(snapshot.id);
        const evidenceInputs = scanResult.artifacts.map(artifact => {
            const persistedId = persistedArtifacts.find(pa => pa.artifactKey === artifact.stableId)?.id;
            if (!persistedId) return null;
            
            const excerpt = artifact.excerpt || '';
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
                isRedacted: false,
                redactionMetadata: null,
            };
        }).filter(Boolean);

        await this.evidenceRepo.upsertMany(evidenceInputs as any);

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
        payload: { jobId: job.id },
      });
    } catch (error) {
      await this.scanJobRepository.updateState({
        jobId: job.id,
        status: ScanJobStatus.FAILED,
        stage: ScanJobStage.DONE,
        progress: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      
      await this.eventLogService.recordEvent({
        eventType: 'SCAN_JOB_FAILED',
        idempotencyKey: `scan-job:${job.id}:failed`,
        payload: { jobId: job.id },
      });
      throw error;
    }
  }
}
