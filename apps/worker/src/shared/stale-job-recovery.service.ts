import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaService } from '@ba-helper/backend-runtime/prisma';
import { QueueService } from '@ba-helper/backend-runtime/queue';
import { EventLogService } from '@ba-helper/backend-runtime';
import { enqueueQueuedRows, QueueEnqueueFailure } from './enqueue-queued-job-rows';
import { failExpiredQueueRows } from './fail-expired-queue-rows';
import {
  failStaleRows,
  STALE_JOB_ERROR_CODE,
  STALE_JOB_ERROR_MESSAGE,
} from './stale-job-failure';

const DEFAULT_LEASE_MS = 15 * 60 * 1000;
const DEFAULT_QUEUE_RECOVERY_BATCH_SIZE = 250;
const DEFAULT_QUEUED_JOB_RECOVERY_INTERVAL_MS = 30 * 1000;

/**
 * How long a job may sit in RUNNING with no progress before it is considered
 * orphaned. Kept generous so a genuinely in-flight job is never reaped; a worker
 * crash leaves rows RUNNING with an `updatedAt` that ages past this lease.
 */
export function resolveStaleJobLeaseMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.STALE_JOB_RECOVERY_LEASE_MS);
  return Number.isInteger(raw) && raw >= 0 ? raw : DEFAULT_LEASE_MS;
}

export function resolveQueuedJobRecoveryIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env.QUEUED_JOB_RECOVERY_INTERVAL_MS);
  return Number.isInteger(raw) && raw >= 1_000 && raw <= 300_000
    ? raw
    : DEFAULT_QUEUED_JOB_RECOVERY_INTERVAL_MS;
}

export interface StaleJobRecoverySummary {
  scanJobs: number;
  impactAnalyses: number;
  documentJobs: number;
}

export interface QueuedJobRecoverySummary {
  scanJobs: number;
  impactAnalyses: number;
  documentJobs: number;
}

/**
 * Domain-state recovery for jobs orphaned by a worker crash.
 *
 * BullMQ recovers stalled queue jobs on its own. This worker also re-enqueues
 * persisted QUEUED product rows that have no Redis job, and fails stale RUNNING
 * rows only when their deterministic BullMQ job is missing or terminal.
 */
@Injectable()
export class StaleJobRecoveryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(StaleJobRecoveryService.name);
  private periodicJobRecoveryTimer?: NodeJS.Timeout;
  private periodicJobRecoveryTask?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly eventLog: EventLogService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const stale = await this.recoverStaleRunningJobs();
    const queued = await this.recoverQueuedJobsSafely('startup');
    const staleTotal = Object.values(stale).reduce((sum, count) => sum + count, 0);
    if (staleTotal > 0) {
      this.logger.warn(
        JSON.stringify({ event: 'WORKER_JOB_RECOVERY', trigger: 'startup', stale, requeued: queued }),
      );
    }
    this.startPeriodicJobRecovery();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.periodicJobRecoveryTimer) {
      clearInterval(this.periodicJobRecoveryTimer);
      this.periodicJobRecoveryTimer = undefined;
    }
    await this.periodicJobRecoveryTask;
  }

  async recoverQueuedJobs(params?: { batchSize?: number }): Promise<QueuedJobRecoverySummary> {
    const requestedBatchSize = params?.batchSize;
    const batchSize = typeof requestedBatchSize === 'number'
      && Number.isInteger(requestedBatchSize)
      && requestedBatchSize > 0
      ? requestedBatchSize
      : DEFAULT_QUEUE_RECOVERY_BATCH_SIZE;
    const [scanJobs, impactAnalyses, documentJobs] = await Promise.all([
      enqueueQueuedRows(
        'scan-job',
        (cursor) => this.prisma.scanJob.findMany({
          where: { status: 'QUEUED' },
          select: { id: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: batchSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
        (id) => this.queue.enqueueScanJob(id),
        batchSize,
      ),
      enqueueQueuedRows(
        'impact-analysis',
        (cursor) => this.prisma.impactAnalysis.findMany({
          where: { status: 'QUEUED' },
          select: { id: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: batchSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
        (id) => this.queue.enqueueImpactAnalysis(id),
        batchSize,
      ),
      enqueueQueuedRows(
        'document-job',
        (cursor) => this.prisma.documentJob.findMany({
          where: { status: 'QUEUED' },
          select: { id: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: batchSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
        (id) => this.queue.enqueueDocumentJob(id),
        batchSize,
      ),
    ]);

    return { scanJobs, impactAnalyses, documentJobs };
  }

  private startPeriodicJobRecovery(): void {
    if (this.periodicJobRecoveryTimer) return;
    this.periodicJobRecoveryTimer = setInterval(() => {
      if (this.periodicJobRecoveryTask) return;
      this.periodicJobRecoveryTask = this.runPeriodicJobRecovery()
        .finally(() => {
          this.periodicJobRecoveryTask = undefined;
        });
    }, resolveQueuedJobRecoveryIntervalMs());
    this.periodicJobRecoveryTimer.unref?.();
  }

  private async runPeriodicJobRecovery(): Promise<void> {
    const [requeued, stale] = await Promise.all([
      this.recoverQueuedJobsSafely('periodic'),
      this.recoverStaleJobsSafely('periodic'),
    ]);
    if (Object.values(requeued).some((count) => count > 0)
      || Object.values(stale).some((count) => count > 0)) {
      this.logger.warn(JSON.stringify({
        event: 'WORKER_JOB_RECOVERY',
        trigger: 'periodic',
        stale,
        requeued,
      }));
    }
  }

  private async recoverQueuedJobsSafely(
    trigger: 'startup' | 'periodic',
  ): Promise<QueuedJobRecoverySummary> {
    try {
      return await this.recoverQueuedJobs();
    } catch (error) {
      const enqueueFailure = error instanceof QueueEnqueueFailure ? error : undefined;
      this.logger.error(JSON.stringify({
        event: 'WORKER_QUEUED_JOB_RECOVERY_FAILED',
        trigger,
        failureStage: enqueueFailure ? 'REDIS_ENQUEUE' : 'POSTGRES_READ',
        retryable: true,
        errorCode: enqueueFailure ? 'QUEUE_ENQUEUE_FAILED' : 'QUEUE_RECOVERY_QUERY_FAILED',
        ...(enqueueFailure ? {
          queueName: enqueueFailure.queueName,
          jobId: enqueueFailure.jobId,
        } : {}),
      }));
      return { scanJobs: 0, impactAnalyses: 0, documentJobs: 0 };
    }
  }

  private async recoverStaleJobsSafely(
    trigger: 'periodic',
  ): Promise<StaleJobRecoverySummary> {
    try {
      return await this.recoverStaleRunningJobs();
    } catch {
      this.logger.error(JSON.stringify({
        event: 'WORKER_STALE_JOB_RECOVERY_FAILED',
        trigger,
        retryable: true,
        errorCode: 'STALE_JOB_RECOVERY_FAILED',
      }));
      return { scanJobs: 0, impactAnalyses: 0, documentJobs: 0 };
    }
  }

  async recoverStaleRunningJobs(params?: {
    now?: Date;
    leaseMs?: number;
  }): Promise<StaleJobRecoverySummary> {
    const now = params?.now ?? new Date();
    const leaseMs = params?.leaseMs ?? resolveStaleJobLeaseMs();
    const cutoff = new Date(now.getTime() - leaseMs);
    const staleFilter = { status: 'RUNNING' as const, updatedAt: { lt: cutoff } };
    const stalePageArgs = (cursor?: string) => ({
      where: staleFilter,
      select: { id: true, status: true, updatedAt: true },
      orderBy: { id: 'asc' as const },
      take: DEFAULT_QUEUE_RECOVERY_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const [scanJobs, impactAnalyses, documentJobs] = await Promise.all([
      failExpiredQueueRows(
        (cursor) => this.prisma.scanJob.findMany(stalePageArgs(cursor)),
        (ids) => failStaleRows(this.prisma, this.eventLog, ids, {
          eventType: 'SCAN_JOB_FAILED',
          idempotencyKey: (id) => `scan-job:${id}:stale-recovery-failed`,
          payload: (id) => ({ scanJobId: id }),
          update: (tx, id) => tx.scanJob.updateMany({
            where: { id, ...staleFilter },
            data: {
              status: 'FAILED',
              stage: 'DONE',
              errorCode: STALE_JOB_ERROR_CODE,
              errorMessage: STALE_JOB_ERROR_MESSAGE,
            },
          }),
        }),
        (id) => this.queue.hasUnfinishedJob('scan-job', id),
        DEFAULT_QUEUE_RECOVERY_BATCH_SIZE,
        cutoff,
      ),
      failExpiredQueueRows(
        (cursor) => this.prisma.impactAnalysis.findMany(stalePageArgs(cursor)),
        (ids) => failStaleRows(this.prisma, this.eventLog, ids, {
          eventType: 'ANALYSIS_FAILED',
          idempotencyKey: (id) => `analysis:${id}:stale-recovery-failed`,
          payload: (id) => ({ analysisId: id }),
          update: (tx, id) => tx.impactAnalysis.updateMany({
            where: { id, ...staleFilter },
            data: {
              status: 'FAILED',
              error: {
                code: STALE_JOB_ERROR_CODE,
                message: STALE_JOB_ERROR_MESSAGE,
                retryable: true,
              },
            },
          }),
        }),
        (id) => this.queue.hasUnfinishedJob('impact-analysis', id),
        DEFAULT_QUEUE_RECOVERY_BATCH_SIZE,
        cutoff,
      ),
      failExpiredQueueRows(
        (cursor) => this.prisma.documentJob.findMany(stalePageArgs(cursor)),
        (ids) => failStaleRows(this.prisma, this.eventLog, ids, {
          eventType: 'DOCUMENT_JOB_FAILED',
          idempotencyKey: (id) => `document-job:${id}:stale-recovery-failed`,
          payload: (id) => ({ documentJobId: id }),
          update: (tx, id) => tx.documentJob.updateMany({
            where: { id, ...staleFilter },
            data: {
              status: 'FAILED',
              error: { code: STALE_JOB_ERROR_CODE },
              failedAt: now,
            },
          }),
        }),
        (id) => this.queue.hasUnfinishedJob('document-job', id),
        DEFAULT_QUEUE_RECOVERY_BATCH_SIZE,
        cutoff,
      ),
    ]);

    return {
      scanJobs,
      impactAnalyses,
      documentJobs,
    };
  }

}
