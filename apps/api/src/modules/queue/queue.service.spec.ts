import { QueueService } from './queue.service';

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
});
