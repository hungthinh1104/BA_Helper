import {
  StaleJobRecoveryService,
  resolveQueuedJobRecoveryIntervalMs,
  resolveStaleJobLeaseMs,
} from './stale-job-recovery.service';

describe('resolveQueuedJobRecoveryIntervalMs', () => {
  it('defaults to 30 seconds', () => {
    expect(resolveQueuedJobRecoveryIntervalMs({})).toBe(30_000);
  });

  it('honors a bounded positive override', () => {
    expect(resolveQueuedJobRecoveryIntervalMs({ QUEUED_JOB_RECOVERY_INTERVAL_MS: '60000' }))
      .toBe(60_000);
  });

  it('falls back to the default for invalid overrides', () => {
    expect(resolveQueuedJobRecoveryIntervalMs({ QUEUED_JOB_RECOVERY_INTERVAL_MS: 'nope' }))
      .toBe(30_000);
    expect(resolveQueuedJobRecoveryIntervalMs({ QUEUED_JOB_RECOVERY_INTERVAL_MS: '10' }))
      .toBe(30_000);
    expect(resolveQueuedJobRecoveryIntervalMs({ QUEUED_JOB_RECOVERY_INTERVAL_MS: '400000' }))
      .toBe(30_000);
  });
});

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
  it('re-enqueues persisted QUEUED jobs across all durable job types in pages', async () => {
    const scanJobFindMany = jest.fn(async ({ cursor }: { cursor?: { id: string } }) => {
      if (!cursor) return [{ id: 'scan-1' }];
      if (cursor.id === 'scan-1') return [{ id: 'scan-2' }];
      return [];
    });
    const impactAnalysisFindMany = jest.fn(async ({ cursor }: { cursor?: { id: string } }) =>
      cursor ? [] : [{ id: 'analysis-1' }],
    );
    const documentJobFindMany = jest.fn(async ({ cursor }: { cursor?: { id: string } }) =>
      cursor ? [] : [{ id: 'document-1' }],
    );
    const prisma = {
      scanJob: { findMany: scanJobFindMany },
      impactAnalysis: { findMany: impactAnalysisFindMany },
      documentJob: { findMany: documentJobFindMany },
    };
    const queueService = {
      enqueueScanJob: jest.fn().mockResolvedValue(undefined),
      enqueueImpactAnalysis: jest.fn().mockResolvedValue(undefined),
      enqueueDocumentJob: jest.fn().mockResolvedValue(undefined),
    };
    const service = new StaleJobRecoveryService(
      prisma as never,
      queueService as never,
      { recordEvent: jest.fn() } as never,
    );

    const result = await service.recoverQueuedJobs({ batchSize: 1 });

    expect(result).toEqual({ scanJobs: 2, impactAnalyses: 1, documentJobs: 1 });
    expect(queueService.enqueueScanJob).toHaveBeenNthCalledWith(1, 'scan-1');
    expect(queueService.enqueueScanJob).toHaveBeenNthCalledWith(2, 'scan-2');
    expect(queueService.enqueueImpactAnalysis).toHaveBeenCalledWith('analysis-1');
    expect(queueService.enqueueDocumentJob).toHaveBeenCalledWith('document-1');
    expect(scanJobFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'QUEUED' },
      select: { id: true },
      take: 1,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }));
    expect(scanJobFindMany).toHaveBeenCalledTimes(3);
  });

  it('fails expired RUNNING jobs only when no unfinished BullMQ job exists', async () => {
    const prisma = {
      scanJob: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'scan-live', status: 'RUNNING', updatedAt: new Date('2026-07-26T11:00:00.000Z') },
          { id: 'scan-orphan', status: 'RUNNING', updatedAt: new Date('2026-07-26T11:00:00.000Z') },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      impactAnalysis: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'analysis-failed', status: 'RUNNING', updatedAt: new Date('2026-07-26T11:00:00.000Z') },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      documentJob: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'document-orphan', status: 'RUNNING', updatedAt: new Date('2026-07-26T11:00:00.000Z') },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const transactionClient = {
      scanJob: prisma.scanJob,
      impactAnalysis: prisma.impactAnalysis,
      documentJob: prisma.documentJob,
    };
    const transactionalPrisma = {
      ...prisma,
      $transaction: jest.fn(async (operation: (tx: typeof transactionClient) => Promise<unknown>) =>
        operation(transactionClient),
      ),
    };
    const queue = {
      hasUnfinishedJob: jest.fn(async (queueName: string, id: string) =>
        queueName === 'scan-job' && id === 'scan-live',
      ),
    };
    const eventLog = { recordEvent: jest.fn().mockResolvedValue(undefined) };
    const service = new StaleJobRecoveryService(
      transactionalPrisma as never,
      queue as never,
      eventLog as never,
    );
    const now = new Date('2026-07-26T12:00:00.000Z');

    const result = await service.recoverStaleRunningJobs({ now, leaseMs: 900_000 });

    expect(result).toEqual({ scanJobs: 1, impactAnalyses: 1, documentJobs: 1 });
    const expectedCutoff = new Date('2026-07-26T11:45:00.000Z');
    expect(prisma.scanJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true, status: true, updatedAt: true },
    }));
    expect(queue.hasUnfinishedJob).toHaveBeenCalledTimes(4);
    expect(queue.hasUnfinishedJob).toHaveBeenCalledWith('scan-job', 'scan-live');
    expect(queue.hasUnfinishedJob).toHaveBeenCalledWith('scan-job', 'scan-orphan');
    expect(queue.hasUnfinishedJob).toHaveBeenCalledWith('impact-analysis', 'analysis-failed');
    expect(queue.hasUnfinishedJob).toHaveBeenCalledWith('document-job', 'document-orphan');
    expect(prisma.scanJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'scan-orphan',
        status: 'RUNNING',
        updatedAt: { lt: expectedCutoff },
      },
      data: {
        status: 'FAILED',
        stage: 'DONE',
        errorCode: 'WORKER_JOB_ORPHANED',
        errorMessage: 'The worker lease expired and no active queue job remains.',
      },
    });
    expect(prisma.impactAnalysis.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'analysis-failed',
        status: 'RUNNING',
        updatedAt: { lt: expectedCutoff },
      },
      data: {
        status: 'FAILED',
        error: {
          code: 'WORKER_JOB_ORPHANED',
          message: 'The worker lease expired and no active queue job remains.',
          retryable: true,
        },
      },
    });
    expect(prisma.documentJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'document-orphan',
        status: 'RUNNING',
        updatedAt: { lt: expectedCutoff },
      },
      data: {
        status: 'FAILED',
        error: { code: 'WORKER_JOB_ORPHANED' },
        failedAt: expect.any(Date),
      },
    });
    expect(transactionalPrisma.$transaction).toHaveBeenCalledTimes(3);
    expect(eventLog.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'SCAN_JOB_FAILED',
      idempotencyKey: 'scan-job:scan-orphan:stale-recovery-failed',
      payload: expect.objectContaining({
        scanJobId: 'scan-orphan',
        previousStatus: 'RUNNING',
        nextStatus: 'FAILED',
        errorCode: 'WORKER_JOB_ORPHANED',
      }),
    }), transactionClient);
    expect(eventLog.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'ANALYSIS_FAILED',
      idempotencyKey: 'analysis:analysis-failed:stale-recovery-failed',
      payload: expect.objectContaining({
        analysisId: 'analysis-failed',
        previousStatus: 'RUNNING',
        nextStatus: 'FAILED',
        errorCode: 'WORKER_JOB_ORPHANED',
      }),
    }), transactionClient);
    expect(eventLog.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'DOCUMENT_JOB_FAILED',
      idempotencyKey: 'document-job:document-orphan:stale-recovery-failed',
      payload: expect.objectContaining({
        documentJobId: 'document-orphan',
        previousStatus: 'RUNNING',
        nextStatus: 'FAILED',
        errorCode: 'WORKER_JOB_ORPHANED',
      }),
    }), transactionClient);
  });

  it('does not write a stale-failure event when the compare-and-set loses a race', async () => {
    const row = {
      id: 'scan-recovered-concurrently',
      status: 'RUNNING',
      updatedAt: new Date('2026-07-26T11:00:00.000Z'),
    };
    const scanJob = {
      findMany: jest.fn().mockResolvedValue([row]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const impactAnalysis = { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() };
    const documentJob = { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() };
    const transactionClient = { scanJob, impactAnalysis, documentJob };
    const prisma = {
      scanJob,
      impactAnalysis,
      documentJob,
      $transaction: jest.fn(async (operation: (tx: typeof transactionClient) => Promise<unknown>) =>
        operation(transactionClient),
      ),
    };
    const eventLog = { recordEvent: jest.fn().mockResolvedValue(undefined) };
    const service = new StaleJobRecoveryService(
      prisma as never,
      { hasUnfinishedJob: jest.fn().mockResolvedValue(false) } as never,
      eventLog as never,
    );

    const result = await service.recoverStaleRunningJobs({
      now: new Date('2026-07-26T12:00:00.000Z'),
      leaseMs: 900_000,
    });

    expect(result).toEqual({ scanJobs: 0, impactAnalyses: 0, documentJobs: 0 });
    expect(eventLog.recordEvent).not.toHaveBeenCalled();
  });

  it('rejects recovery when recording the transition audit fails', async () => {
    const row = {
      id: 'scan-audit-failure',
      status: 'RUNNING',
      updatedAt: new Date('2026-07-26T11:00:00.000Z'),
    };
    const scanJob = {
      findMany: jest.fn().mockResolvedValue([row]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const impactAnalysis = { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() };
    const documentJob = { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() };
    const transactionClient = { scanJob, impactAnalysis, documentJob };
    const prisma = {
      scanJob,
      impactAnalysis,
      documentJob,
      $transaction: jest.fn(async (operation: (tx: typeof transactionClient) => Promise<unknown>) =>
        operation(transactionClient),
      ),
    };
    const eventLog = { recordEvent: jest.fn().mockRejectedValue(new Error('audit storage unavailable')) };
    const service = new StaleJobRecoveryService(
      prisma as never,
      { hasUnfinishedJob: jest.fn().mockResolvedValue(false) } as never,
      eventLog as never,
    );

    await expect(service.recoverStaleRunningJobs({
      now: new Date('2026-07-26T12:00:00.000Z'),
      leaseMs: 900_000,
    })).rejects.toThrow('audit storage unavailable');
    expect(eventLog.recordEvent).toHaveBeenCalledTimes(1);
  });

  it('does not fail stale rows when BullMQ state cannot be inspected', async () => {
    const prisma = {
      scanJob: { findMany: jest.fn().mockResolvedValue([{ id: 'scan-1' }]), updateMany: jest.fn() },
      impactAnalysis: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
      documentJob: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    };
    const queue = { hasUnfinishedJob: jest.fn().mockRejectedValue(new Error('redis unavailable')) };
    const service = new StaleJobRecoveryService(prisma as never, queue as never, { recordEvent: jest.fn() } as never);

    await expect(service.recoverStaleRunningJobs({ leaseMs: 1_000 })).rejects.toThrow(
      'redis unavailable',
    );
    expect(prisma.scanJob.updateMany).not.toHaveBeenCalled();
  });
});
