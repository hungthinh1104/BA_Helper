import { QueueService } from '../index';

const makeQueue = () => ({
  add: jest.fn().mockResolvedValue(undefined),
  client: Promise.resolve({
    ping: jest.fn().mockResolvedValue('PONG'),
    eval: jest.fn().mockResolvedValue([1, 60_000]),
  }),
  getJobCounts: jest.fn().mockResolvedValue({}),
  getJob: jest.fn(),
});

describe('QueueService', () => {
  it('uses a deterministic embedding job id per snapshot', async () => {
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

    expect(embeddingQueue.add).toHaveBeenCalledTimes(2);
    expect(embeddingQueue.add).toHaveBeenNthCalledWith(
      1,
      'embed_snapshot',
      { snapshotId: 'snapshot-1' },
      expect.objectContaining({
        jobId: 'embed-snapshot-1',
        attempts: 3,
        removeOnFail: { age: 1209600, count: 5000 },
      }),
    );
    expect(embeddingQueue.add).toHaveBeenNthCalledWith(
      2,
      'embed_snapshot',
      { snapshotId: 'snapshot-1' },
      expect.objectContaining({
        jobId: 'embed-snapshot-1',
        attempts: 3,
        removeOnFail: { age: 1209600, count: 5000 },
      }),
    );
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
      retry: jest.fn(),
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
