import { RunScanJobPersistenceStep } from './run-scan-job-persistence.step';

describe('RunScanJobPersistenceStep repository target identity', () => {
  const repositoryId = '00000000-0000-4000-8000-000000000001';
  const jobId = '00000000-0000-4000-8000-000000000002';
  const commitSha = '78547792178275bb76ba1550c41265f55f79350a';

  function createStep() {
    const prisma = {
      repositoryTarget: { upsert: jest.fn().mockResolvedValue({ id: 'target-id' }) },
    };
    const step = new RunScanJobPersistenceStep(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { step, upsert: prisma.repositoryTarget.upsert };
  }

  it('persists a full SHA ref as an immutable commit target', async () => {
    const { step, upsert } = createStep();

    await step.observeTarget({
      job: { id: jobId, repositoryId, requestedRef: commitSha },
      commitSha,
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ resolvedRefType: 'COMMIT' }),
      update: expect.objectContaining({ resolvedRefType: 'COMMIT' }),
    }));
  });

  it('keeps a branch ref as a moving branch target', async () => {
    const { step, upsert } = createStep();

    await step.observeTarget({
      job: { id: jobId, repositoryId, requestedRef: 'main' },
      commitSha,
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ resolvedRefType: 'BRANCH' }),
    }));
  });
});
