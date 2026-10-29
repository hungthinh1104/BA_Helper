import { describe, expect, it, jest } from '@jest/globals';
import type { PrismaService } from '../../prisma/prisma.service';
import { RuntimeDocumentJobRunnerAdapter } from './runtime-document-job-runner.adapter';

describe('RuntimeDocumentJobRunnerAdapter', () => {
  it('keeps a retryable job running so the next BullMQ attempt can finish it', async () => {
    let status = 'QUEUED';
    const documentJob = { id: 'document-job-1', snapshotId: 'snapshot-1' };
    const transaction = {
      documentJob: {
        update: jest.fn(async ({ data }: { data: { status: string } }) => {
          status = data.status;
          return { ...documentJob, status };
        }),
      },
      reviewedReportSnapshot: { update: jest.fn() },
    };
    const prisma = {
      documentJob: {
        findUnique: jest.fn(async () => ({ ...documentJob, status })),
        update: jest.fn(async ({ data }: { data: { status: string } }) => {
          status = data.status;
          return { ...documentJob, status };
        }),
      },
      reviewedReportSnapshot: {
        findUnique: jest.fn<() => Promise<unknown>>()
          .mockResolvedValue({ id: 'snapshot-1', analysisId: 'analysis-1' }),
      },
      impactAnalysis: {
        findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({ id: 'analysis-1' }),
      },
      $transaction: jest.fn(async (run: (tx: typeof transaction) => Promise<unknown>) => run(transaction)),
    };
    const contextAdapter = {
      buildContext: jest.fn<() => Promise<unknown>>()
        .mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))
        .mockResolvedValueOnce({}),
    };
    const reportBuilder = { build: jest.fn<() => string>().mockReturnValue('# Approved report') };
    const documentRepo = {
      upsertApproved: jest.fn<() => Promise<{ id: string }>>()
        .mockResolvedValue({ id: 'approved-document-1' }),
    };
    const adapter = new RuntimeDocumentJobRunnerAdapter(
      prisma as unknown as PrismaService,
      reportBuilder as never,
      documentRepo as never,
      contextAdapter as never,
    );

    await expect(adapter.run({
      documentJobId: documentJob.id,
      attemptNumber: 1,
      maxAttempts: 3,
    })).rejects.toThrow('timeout exceeded when trying to connect');
    expect(status).toBe('RUNNING');

    await expect(adapter.run({
      documentJobId: documentJob.id,
      attemptNumber: 2,
      maxAttempts: 3,
    })).resolves.toMatchObject({ success: true, generatedDocumentId: 'approved-document-1' });
    expect(status).toBe('COMPLETED');
    expect(contextAdapter.buildContext).toHaveBeenCalledTimes(2);
  });
});
