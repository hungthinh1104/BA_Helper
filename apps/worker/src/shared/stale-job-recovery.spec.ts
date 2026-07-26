import {
  StaleJobRecoveryService,
  resolveStaleJobLeaseMs,
} from './stale-job-recovery.service';

describe('resolveStaleJobLeaseMs', () => {
  it('defaults to 15 minutes', () => {
    expect(resolveStaleJobLeaseMs({})).toBe(15 * 60 * 1000);
  });

  it('honors a valid override', () => {
    expect(resolveStaleJobLeaseMs({ STALE_JOB_RECOVERY_LEASE_MS: '60000' })).toBe(60000);
  });

  it('falls back to the default for invalid overrides', () => {
    expect(resolveStaleJobLeaseMs({ STALE_JOB_RECOVERY_LEASE_MS: 'nope' })).toBe(
      15 * 60 * 1000,
    );
    expect(resolveStaleJobLeaseMs({ STALE_JOB_RECOVERY_LEASE_MS: '-5' })).toBe(
      15 * 60 * 1000,
    );
  });
});

describe('StaleJobRecoveryService', () => {
  it('fails only RUNNING jobs older than the lease and reports counts per queue', async () => {
    const prisma = {
      scanJob: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      impactAnalysis: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      documentJob: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new StaleJobRecoveryService(prisma as never);
    const now = new Date('2026-07-26T12:00:00.000Z');

    const result = await service.recoverStaleRunningJobs({ now, leaseMs: 900_000 });

    expect(result).toEqual({ scanJobs: 2, impactAnalyses: 0, documentJobs: 1 });
    // Everything runs inside a single transaction.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const expectedCutoff = new Date('2026-07-26T11:45:00.000Z');
    for (const model of [prisma.scanJob, prisma.impactAnalysis, prisma.documentJob]) {
      expect(model.updateMany).toHaveBeenCalledWith({
        where: { status: 'RUNNING', updatedAt: { lt: expectedCutoff } },
        data: { status: 'FAILED' },
      });
    }
  });
});
