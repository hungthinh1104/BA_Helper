import { ScanJobRepository } from '../infrastructure/scan-job.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';
import { ScanJobStatus, ScanJobStage } from '@prisma/client';
import { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { scanFixture } from '@ba-helper/analyzer';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';

export class RunScanJobUseCase {
  constructor(
    private readonly scanJobRepository: ScanJobRepository,
    private readonly artifactRepository: ArtifactRepository,
    private readonly eventLogService: EventLogService,
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

      const snapshot = await this.prisma.repositorySnapshot.create({
        data: {
          repositoryId: job.repositoryId,
          commitSha: 'mock-commit-sha', // TODO: Get actual commit SHA
          analyzerVersion: scanResult.analyzerVersion,
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
        data: { snapshotId: snapshot.id },
      });

      if (scanResult.artifacts.length > 0) {
        await this.artifactRepository.createMany(
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
