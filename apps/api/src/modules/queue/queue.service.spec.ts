import { QueueService } from "@ba-helper/backend-runtime";

const makeQueue = () => ({
  add: jest.fn().mockResolvedValue(undefined),
  client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
  getJobCounts: jest.fn().mockResolvedValue({}),
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
      { jobId: 'embed-snapshot-1' },
    );
    expect(embeddingQueue.add).toHaveBeenNthCalledWith(
      2,
      'embed_snapshot',
      { snapshotId: 'snapshot-1' },
      { jobId: 'embed-snapshot-1' },
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
