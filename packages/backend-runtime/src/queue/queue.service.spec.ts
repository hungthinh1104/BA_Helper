import { QueueService } from '../index';

type MockQueueJob = {
  name?: string;
  data?: unknown;
  getState?: () => Promise<string>;
};

const makeQueue = () => {
  const jobs = new Map<string, MockQueueJob>();
  return {
    add: jest.fn(async (name: string, data: unknown, options?: { jobId?: string }) => {
      const job = { name, data, getState: jest.fn().mockResolvedValue('waiting') };
      if (options?.jobId) jobs.set(options.jobId, job);
      return job;
    }),
    client: Promise.resolve({
      ping: jest.fn().mockResolvedValue('PONG'),
      eval: jest.fn().mockResolvedValue([1, 60_000]),
    }),
    getJobCounts: jest.fn().mockResolvedValue({}),
    getJob: jest.fn(async (jobId: string) => jobs.get(jobId)),
  };
};

describe('QueueService', () => {
  it('retries a retained failed scan job instead of re-adding its deterministic id', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const job = {
      name: 'scan',
      data: { jobId: 'scan-job-1' },
      getState: jest.fn().mockResolvedValue('failed'),
      retry: jest.fn().mockResolvedValue(undefined),
    };
    scanJobQueue.getJob.mockResolvedValue(job);
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await service.enqueueScanJob('scan-job-1');

    expect(scanJobQueue.getJob).toHaveBeenCalledWith('scan-scan-job-1');
    expect(job.retry).toHaveBeenCalledWith('failed');
    expect(scanJobQueue.add).not.toHaveBeenCalled();
  });

  it('retries a retained failed analysis job instead of re-adding its deterministic id', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const job = {
      name: 'run',
      data: { analysisId: 'analysis-1' },
      getState: jest.fn().mockResolvedValue('failed'),
      retry: jest.fn().mockResolvedValue(undefined),
    };
    impactQueue.getJob.mockResolvedValue(job);
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await service.enqueueImpactAnalysis('analysis-1');

    expect(impactQueue.getJob).toHaveBeenCalledWith('impact-analysis-1');
    expect(job.retry).toHaveBeenCalledWith('failed');
    expect(impactQueue.add).not.toHaveBeenCalled();
  });

  it('retries a retained failed embedding job instead of re-adding its deterministic id', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const job = {
      name: 'embed_snapshot',
      data: { snapshotId: 'snapshot-1' },
      getState: jest.fn().mockResolvedValue('failed'),
      retry: jest.fn().mockResolvedValue(undefined),
    };
    embeddingQueue.getJob.mockResolvedValue(job);
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await service.enqueueSnapshotEmbedding('snapshot-1');

    expect(embeddingQueue.getJob).toHaveBeenCalledWith('embed-snapshot-1');
    expect(job.retry).toHaveBeenCalledWith('failed');
    expect(embeddingQueue.add).not.toHaveBeenCalled();
  });

  it('reuses a deterministic embedding job id per snapshot', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await service.enqueueSnapshotEmbedding('snapshot-1');
    await service.enqueueSnapshotEmbedding('snapshot-1');

    expect(embeddingQueue.add).toHaveBeenCalledTimes(1);
    expect(embeddingQueue.add).toHaveBeenCalledWith(
      'embed_snapshot',
      { snapshotId: 'snapshot-1' },
      expect.objectContaining({
        jobId: 'embed-snapshot-1',
        attempts: 3,
        removeOnFail: { age: 1209600, count: 5000 },
      }),
    );
  });

  it.each([
    { name: 'unexpected-job-name', data: { analysisId: 'analysis-1' } },
    { name: 'run', data: { analysisId: 'different-analysis-id' } },
  ])('rejects an existing analysis job with mismatched identity', async ({ name, data }) => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const job = {
      name,
      data,
      getState: jest.fn().mockResolvedValue('waiting'),
      retry: jest.fn(),
    };
    impactQueue.getJob.mockResolvedValue(job);
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await expect(service.enqueueImpactAnalysis('analysis-1')).rejects.toThrow(
      'already exists with a different name or payload',
    );
    expect(job.getState).not.toHaveBeenCalled();
    expect(job.retry).not.toHaveBeenCalled();
  });

  it('verifies stored job identity when another producer wins the deterministic ID race', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const conflictingJob = {
      name: 'run',
      data: { analysisId: 'different-analysis-id' },
      getState: jest.fn().mockResolvedValue('waiting'),
    };
    impactQueue.getJob
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(conflictingJob);
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await expect(service.enqueueImpactAnalysis('analysis-1')).rejects.toThrow(
      'already exists with a different name or payload',
    );
    expect(impactQueue.add).toHaveBeenCalledWith(
      'run',
      { analysisId: 'analysis-1' },
      expect.objectContaining({ jobId: 'impact-analysis-1' }),
    );
  });

  it('retries a retained failed document job instead of re-adding its deterministic queue id', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const job = {
      name: 'generate',
      data: { documentJobId: 'document-job-1' },
      getState: jest.fn().mockResolvedValue('failed'),
      retry: jest.fn().mockResolvedValue(undefined),
    };
    documentJobQueue.getJob.mockResolvedValue(job);
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await service.enqueueDocumentJob('document-job-1');

    expect(documentJobQueue.getJob).toHaveBeenCalledWith('doc-document-job-1');
    expect(job.retry).toHaveBeenCalledWith('failed');
    expect(documentJobQueue.add).not.toHaveBeenCalled();
  });

  it('adds a document job when its deterministic queue id is not retained', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await service.enqueueDocumentJob('document-job-1');

    expect(documentJobQueue.add).toHaveBeenCalledWith(
      'generate',
      { documentJobId: 'document-job-1' },
      expect.objectContaining({ jobId: 'doc-document-job-1', attempts: 3 }),
    );
  });

  it('treats a concurrent document retry already moved to active as delivered', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const job = {
      name: 'generate',
      data: { documentJobId: 'document-job-1' },
      getState: jest.fn().mockResolvedValueOnce('failed').mockResolvedValueOnce('active'),
      retry: jest.fn().mockRejectedValue(new Error('job already moved to active')),
    };
    documentJobQueue.getJob.mockResolvedValue(job);
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await expect(service.enqueueDocumentJob('document-job-1')).resolves.toBeUndefined();

    expect(job.retry).toHaveBeenCalledWith('failed');
    expect(documentJobQueue.add).not.toHaveBeenCalled();
  });

  it('retries only jobs retained in the failed dead-letter set', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const job = {
      getState: jest.fn().mockResolvedValue('failed'),
      retry: jest.fn().mockResolvedValue(undefined),
    };
    scanJobQueue.getJob.mockResolvedValue(job);
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await expect(
      service.retryFailedJob('scan-job', 'scan-job-1'),
    ).resolves.toEqual({
      queueName: 'scan-job',
      jobId: 'scan-job-1',
      productEntityId: 'job-1',
      status: 'RETRIED',
    });
    expect(job.retry).toHaveBeenCalledWith('failed');
  });

  it.each([
    { queueName: 'scan-job' as const, entityId: 'scan-1', queueJobId: 'scan-scan-1', queueIndex: 2 },
    { queueName: 'embedding' as const, entityId: 'snapshot-1', queueJobId: 'embed-snapshot-1', queueIndex: 1 },
    { queueName: 'impact-analysis' as const, entityId: 'analysis-1', queueJobId: 'impact-analysis-1', queueIndex: 0 },
    { queueName: 'document-job' as const, entityId: 'document-1', queueJobId: 'doc-document-1', queueIndex: 3 },
  ])(
    'checks the deterministic $queueName job without failing an active job',
    async ({ queueName, entityId, queueJobId, queueIndex }) => {
      const impactQueue = makeQueue();
      const embeddingQueue = makeQueue();
      const scanJobQueue = makeQueue();
      const documentJobQueue = makeQueue();
      const queues = [impactQueue, embeddingQueue, scanJobQueue, documentJobQueue];
      queues[queueIndex].getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('active'),
      });
      const service = new QueueService(
        impactQueue as never,
        embeddingQueue as never,
        scanJobQueue as never,
        documentJobQueue as never,
      );

      await expect(service.hasUnfinishedJob(queueName, entityId)).resolves.toBe(true);

      expect(queues[queueIndex].getJob).toHaveBeenCalledWith(queueJobId);
    },
  );

  it.each(['waiting', 'delayed', 'waiting-children', 'paused', 'prioritized', 'unknown'])(
    'treats a present %s queue job as unfinished', async (state) => {
      const impactQueue = makeQueue();
      const embeddingQueue = makeQueue();
      const scanJobQueue = makeQueue();
      const documentJobQueue = makeQueue();
      documentJobQueue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue(state),
      });
      const service = new QueueService(
        impactQueue as never,
        embeddingQueue as never,
        scanJobQueue as never,
        documentJobQueue as never,
      );

      await expect(service.hasUnfinishedJob('document-job', 'document-1')).resolves.toBe(true);
    },
  );

  it.each(['completed', 'failed'])('treats terminal queue state %s as finished', async (state) => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    documentJobQueue.getJob.mockResolvedValue({
      getState: jest.fn().mockResolvedValue(state),
    });
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await expect(service.hasUnfinishedJob('document-job', 'document-1')).resolves.toBe(false);
  });

  it('treats a missing queue job as finished and propagates Redis inspection errors', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await expect(service.hasUnfinishedJob('document-job', 'missing')).resolves.toBe(false);
    documentJobQueue.getJob.mockRejectedValue(new Error('redis unavailable'));
    await expect(service.hasUnfinishedJob('document-job', 'document-1')).rejects.toThrow(
      'redis unavailable',
    );
  });

  it('rejects retrying a job that is missing or no longer in the failed set', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    // Not found.
    scanJobQueue.getJob.mockResolvedValue(undefined);
    // Present but already moved out of the failed set (concurrent retry / running).
    embeddingQueue.getJob.mockResolvedValue({
      getState: jest.fn().mockResolvedValue('active'),
    });
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await expect(
      service.retryFailedJob('scan-job', 'scan-missing'),
    ).rejects.toMatchObject({ code: 'FAILED_JOB_NOT_FOUND' });
    await expect(
      service.retryFailedJob('embedding', 'embed-active'),
    ).rejects.toMatchObject({ code: 'FAILED_JOB_NOT_FOUND' });
  });

  it('uses an atomic Redis counter for distributed rate limiting', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    const client = await scanJobQueue.client;
    client.eval.mockResolvedValue([3, 42_000]);
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await expect(
      service.consumeRateLimit({
        key: 'hashed-scope',
        maxRequests: 2,
        windowMs: 60_000,
      }),
    ).resolves.toEqual({
      allowed: false,
      retryAfterMs: 42_000,
      limit: 2,
      windowMs: 60_000,
    });
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      1,
      'ba-helper:rate-limit:hashed-scope',
      '60000',
    );
  });

  it('returns non-sensitive aggregate operations counts', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    scanJobQueue.getJobCounts.mockResolvedValue({
      waiting: 2,
      delayed: 1,
      prioritized: 3,
      active: 4,
      failed: 5,
    });
    impactQueue.getJobCounts.mockResolvedValue({
      waiting: 7,
      active: 8,
      failed: 9,
    });
    documentJobQueue.getJobCounts.mockResolvedValue({
      waiting: 11,
      active: 12,
      failed: 13,
    });
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    await expect(service.getOperationsHealthSummary()).resolves.toEqual({
      scanJobs: { status: 'up', pending: 6, running: 4, failed: 5 },
      analysisJobs: { status: 'up', pending: 7, running: 8, failed: 9 },
      documentJobs: { status: 'up', pending: 11, running: 12, failed: 13 },
    });
  });

  it('marks a queue summary down without exposing job payloads when counts fail', async () => {
    const impactQueue = makeQueue();
    const embeddingQueue = makeQueue();
    const scanJobQueue = makeQueue();
    const documentJobQueue = makeQueue();
    scanJobQueue.getJobCounts.mockRejectedValue(new Error('redis unavailable'));
    const service = new QueueService(
      impactQueue as never,
      embeddingQueue as never,
      scanJobQueue as never,
      documentJobQueue as never,
    );

    const summary = await service.getOperationsHealthSummary();

    expect(summary.scanJobs).toEqual({
      status: 'down',
      pending: 0,
      running: 0,
      failed: 0,
    });
    expect(JSON.stringify(summary)).not.toMatch(/payload|source|prompt|secret/i);
  });
});
