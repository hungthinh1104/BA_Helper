import { GetSystemHealthUseCase } from './get-system-health.usecase';

const healthyOperations = {
  scanJobs: { status: 'up' as const, pending: 1, running: 2, failed: 3 },
  analysisJobs: { status: 'up' as const, pending: 4, running: 5, failed: 6 },
  documentJobs: { status: 'up' as const, pending: 7, running: 8, failed: 9 },
};

describe('GetSystemHealthUseCase', () => {
  const makePrisma = () => ({
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ extname: 'vector' }]),
  });

  const makeQueue = () => ({
    checkQueueHealth: jest.fn().mockResolvedValue({ redis: true, queue: true }),
    getOperationsHealthSummary: jest.fn().mockResolvedValue(healthyOperations),
  });

  it('returns backend-authored dependency and operations health summary', async () => {
    const useCase = new GetSystemHealthUseCase(
      makePrisma() as never,
      makeQueue() as never,
    );

    const result = await useCase.execute();

    expect(result.status).toBe('ok');
    expect(result.dependencies).toEqual({
      database: 'up',
      pgvector: 'up',
      queue: 'up',
      redis: 'up',
    });
    expect(result.operations).toEqual(healthyOperations);
  });

  it('maps database failure to degraded without checking pgvector', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('db down')) };
    const useCase = new GetSystemHealthUseCase(
      prisma as never,
      makeQueue() as never,
    );

    const result = await useCase.execute();

    expect(result.status).toBe('degraded');
    expect(result.dependencies.database).toBe('down');
    expect(result.dependencies.pgvector).toBe('down');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('maps queue failure to degraded and returns aggregate counts only', async () => {
    const queue = makeQueue();
    queue.checkQueueHealth.mockResolvedValue({ redis: false, queue: false });
    queue.getOperationsHealthSummary.mockResolvedValue({
      scanJobs: { status: 'down' as const, pending: 0, running: 0, failed: 0 },
      analysisJobs: { status: 'down' as const, pending: 0, running: 0, failed: 0 },
      documentJobs: { status: 'down' as const, pending: 0, running: 0, failed: 0 },
    });
    const useCase = new GetSystemHealthUseCase(
      makePrisma() as never,
      queue as never,
    );

    const result = await useCase.execute();

    expect(result.status).toBe('degraded');
    expect(result.dependencies.queue).toBe('down');
    expect(result.dependencies.redis).toBe('down');
    expect(JSON.stringify(result.operations)).not.toMatch(/payload|source|prompt|secret/i);
  });
});
