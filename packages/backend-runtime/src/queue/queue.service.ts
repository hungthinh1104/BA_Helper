import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AppError } from '@ba-helper/shared';
import { enqueueRetryableJob } from './enqueue-retryable-job';

// BullMQ job ids embed the product entity id behind a per-queue prefix. Admins
// operate on product entities, so we surface the bare entity id in responses.
const JOB_ID_PREFIX: Record<RecoverableQueueName, string> = {
  'scan-job': 'scan-',
  embedding: 'embed-',
  'impact-analysis': 'impact-',
  'document-job': '',
};

const QUEUE_JOB_ID_PREFIX: Record<RecoverableQueueName, string> = {
  'scan-job': 'scan-',
  embedding: 'embed-',
  'impact-analysis': 'impact-',
  'document-job': 'doc-',
};

function toProductEntityId(queueName: RecoverableQueueName, jobId: string): string {
  const prefix = JOB_ID_PREFIX[queueName];
  return prefix && jobId.startsWith(prefix) ? jobId.slice(prefix.length) : jobId;
}

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

export type DistributedRateLimitDecision = {
  allowed: boolean;
  retryAfterMs: number;
  limit: number;
  windowMs: number;
};

export type RecoverableQueueName =
  | 'scan-job'
  | 'embedding'
  | 'impact-analysis'
  | 'document-job';

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
    return enqueueRetryableJob(
      this.impactQueue,
      'run',
      { analysisId },
      `impact-${analysisId}`,
    );
  }

  async enqueueSnapshotEmbedding(snapshotId: string) {
    return enqueueRetryableJob(
      this.embeddingQueue,
      'embed_snapshot',
      { snapshotId },
      `embed-${snapshotId}`,
    );
  }

  async enqueueScanJob(jobId: string) {
    return enqueueRetryableJob(
      this.scanJobQueue,
      'scan',
      { jobId },
      `scan-${jobId}`,
    );
  }

  async enqueueDocumentJob(documentJobId: string) {
    return enqueueRetryableJob(
      this.documentJobQueue,
      'generate',
      { documentJobId },
      `doc-${documentJobId}`,
    );
  }

  async hasUnfinishedJob(
    queueName: RecoverableQueueName,
    productEntityId: string,
  ): Promise<boolean> {
    const jobId = `${QUEUE_JOB_ID_PREFIX[queueName]}${productEntityId}`;
    const job = await this.getQueue(queueName).getJob(jobId);
    if (!job) return false;
    const state = await job.getState();
    return state !== 'completed' && state !== 'failed';
  }

  async retryFailedJob(
    queueName: RecoverableQueueName,
    jobId: string,
  ): Promise<{
    queueName: RecoverableQueueName;
    jobId: string;
    productEntityId: string;
    status: 'RETRIED';
  }> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    // Requiring state 'failed' also guards against concurrent duplicate retries:
    // once the first retry moves the job out of the failed set, a racing second
    // call sees a non-failed state and is rejected rather than double-enqueuing.
    if (!job || (await job.getState()) !== 'failed') {
      throw new AppError(
        'FAILED_JOB_NOT_FOUND',
        `No failed job ${queueName}/${jobId} is available to retry.`,
      );
    }
    await job.retry('failed');
    return {
      queueName,
      jobId,
      productEntityId: toProductEntityId(queueName, jobId),
      status: 'RETRIED',
    };
  }

  async consumeRateLimit(params: {
    key: string;
    maxRequests: number;
    windowMs: number;
  }): Promise<DistributedRateLimitDecision> {
    const client = (await this.scanJobQueue.client) as unknown as {
      eval: (
        script: string,
        keyCount: number,
        key: string,
        windowMs: string,
      ) => Promise<[number, number]>;
    };
    const [count, ttl] = await client.eval(
      [
        "local count = redis.call('INCR', KEYS[1])",
        "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
        "return {count, redis.call('PTTL', KEYS[1])}",
      ].join('\n'),
      1,
      `ba-helper:rate-limit:${params.key}`,
      String(params.windowMs),
    );

    return {
      allowed: count <= params.maxRequests,
      retryAfterMs: Math.max(0, ttl),
      limit: params.maxRequests,
      windowMs: params.windowMs,
    };
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

  private getQueue(queueName: RecoverableQueueName): Queue {
    switch (queueName) {
      case 'scan-job':
        return this.scanJobQueue;
      case 'embedding':
        return this.embeddingQueue;
      case 'impact-analysis':
        return this.impactQueue;
      case 'document-job':
        return this.documentJobQueue;
    }
  }
}
