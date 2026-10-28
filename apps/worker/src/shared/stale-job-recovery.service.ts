import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '@ba-helper/backend-runtime/prisma';
import { QueueService } from '@ba-helper/backend-runtime/queue';

const DEFAULT_LEASE_MS = 15 * 60 * 1000;
const DEFAULT_QUEUE_RECOVERY_BATCH_SIZE = 250;

/**
 * How long a job may sit in RUNNING with no progress before it is considered
 * orphaned. Kept generous so a genuinely in-flight job is never reaped; a worker
 * crash leaves rows RUNNING with an `updatedAt` that ages past this lease.
 */
export function resolveStaleJobLeaseMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.STALE_JOB_RECOVERY_LEASE_MS);
  return Number.isInteger(raw) && raw >= 0 ? raw : DEFAULT_LEASE_MS;
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
 * rows left behind by a worker crash so they become visible and retryable.
 */
@Injectable()
export class StaleJobRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StaleJobRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const stale = await this.recoverStaleRunningJobs();
    const queued = await this.recoverQueuedJobs();
    const total = Object.values(stale).reduce((sum, count) => sum + count, 0) +
      Object.values(queued).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      this.logger.warn(
        JSON.stringify({ event: 'WORKER_JOB_RECOVERY', stale, requeued: queued }),
      );
    }
  }

  async recoverQueuedJobs(params?: { batchSize?: number }): Promise<QueuedJobRecoverySummary> {
    const batchSize = resolveQueueRecoveryBatchSize(params?.batchSize);
    const [scanJobs, impactAnalyses, documentJobs] = await Promise.all([
      enqueueQueuedRows(
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

  async recoverStaleRunningJobs(params?: {
    now?: Date;
    leaseMs?: number;
  }): Promise<StaleJobRecoverySummary> {
    const now = params?.now ?? new Date();
    const leaseMs = params?.leaseMs ?? resolveStaleJobLeaseMs();
    const cutoff = new Date(now.getTime() - leaseMs);
    const staleFilter = { status: 'RUNNING' as const, updatedAt: { lt: cutoff } };

    const [scanJobs, impactAnalyses, documentJobs] = await this.prisma.$transaction([
      this.prisma.scanJob.updateMany({
        where: staleFilter,
        data: { status: 'FAILED' },
      }),
      this.prisma.impactAnalysis.updateMany({
        where: staleFilter,
        data: { status: 'FAILED' },
      }),
      this.prisma.documentJob.updateMany({
        where: staleFilter,
        data: { status: 'FAILED' },
      }),
    ]);

    return {
      scanJobs: scanJobs.count,
      impactAnalyses: impactAnalyses.count,
      documentJobs: documentJobs.count,
    };
  }
}

function resolveQueueRecoveryBatchSize(value?: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_QUEUE_RECOVERY_BATCH_SIZE;
}

async function enqueueQueuedRows(
  findPage: (cursor?: string) => Promise<Array<{ id: string }>>,
  enqueue: (id: string) => Promise<void>,
  batchSize: number,
): Promise<number> {
  let total = 0;
  let cursor: string | undefined;

  while (true) {
    const rows = await findPage(cursor);
    for (const row of rows) await enqueue(row.id);
    total += rows.length;
    if (rows.length < batchSize) return total;
    cursor = rows[rows.length - 1].id;
  }
}
