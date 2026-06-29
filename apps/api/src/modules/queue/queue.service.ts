import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export type QueueJobCountSummary = {
  status: 'up' | 'down';
  pending: number;
  running: number;
  failed: number;
};

export type OperationsQueueSummary = {
  scanJobs: QueueJobCountSummary;
  analysisJobs: QueueJobCountSummary;
  documentJobs: QueueJobCountSummary;
};

export class QueueService {
  constructor(
    @InjectQueue('impact-analysis')
    private readonly impactQueue: Queue,
    @InjectQueue('embedding')
    private readonly embeddingQueue: Queue,
    @InjectQueue('scan-job')
    private readonly scanJobQueue: Queue,
    @InjectQueue('document-job')
    private readonly documentJobQueue: Queue,
  ) {}

  async enqueueImpactAnalysis(analysisId: string) {
    await this.impactQueue.add(
      'run',
      { analysisId },
      { 
        jobId: `impact-${analysisId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      },
    );
  }

  async enqueueSnapshotEmbedding(snapshotId: string) {
    await this.embeddingQueue.add(
      'embed_snapshot',
      { snapshotId },
      { jobId: `embed-${snapshotId}` },
    );
  }

  async enqueueScanJob(jobId: string) {
    await this.scanJobQueue.add(
      'scan',
      { jobId },
      { jobId: `scan-${jobId}` },
    );
  }

  async enqueueDocumentJob(documentJobId: string) {
    // We use a deterministic BullMQ jobId so BullMQ can deduplicate if needed,
    // though Prisma DocumentJob is the true idempotency source of truth.
    const uniqueJobId = `doc-${documentJobId}`;
    await this.documentJobQueue.add(
      'generate',
      { documentJobId },
      { 
        jobId: uniqueJobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      },
    );
  }

  async checkQueueHealth(): Promise<{ redis: boolean; queue: boolean }> {
    try {
      const client = (await this.scanJobQueue.client) as {
        ping?: () => Promise<string>;
      };
      const redisStatus =
        typeof client.ping === 'function'
          ? (await client.ping()) === 'PONG'
          : false;
      await this.scanJobQueue.getJobCounts(
        'active',
        'completed',
        'delayed',
        'failed',
        'paused',
        'prioritized',
        'waiting',
      );

      return {
        queue: true,
        redis: redisStatus,
      };
    } catch {
      return {
        queue: false,
        redis: false,
      };
    }
  }

  async getOperationsHealthSummary(): Promise<OperationsQueueSummary> {
    const [scanJobs, analysisJobs, documentJobs] = await Promise.all([
      this.getQueueJobCountSummary(this.scanJobQueue),
      this.getQueueJobCountSummary(this.impactQueue),
      this.getQueueJobCountSummary(this.documentJobQueue),
    ]);

    return {
      scanJobs,
      analysisJobs,
      documentJobs,
    };
  }

  private async getQueueJobCountSummary(queue: Queue): Promise<QueueJobCountSummary> {
    try {
      const counts = await queue.getJobCounts(
        'active',
        'delayed',
        'failed',
        'prioritized',
        'waiting',
      );

      return {
        status: 'up',
        pending:
          (counts.waiting ?? 0) +
          (counts.delayed ?? 0) +
          (counts.prioritized ?? 0),
        running: counts.active ?? 0,
        failed: counts.failed ?? 0,
      };
    } catch {
      return {
        status: 'down',
        pending: 0,
        running: 0,
        failed: 0,
      };
    }
  }
}
