import { describe, expect, it, jest } from '@jest/globals';
import type { PrismaService } from '../../prisma/prisma.service';
import { RuntimeDocumentJobRunnerAdapter } from './runtime-document-job-runner.adapter';

describe('RuntimeDocumentJobRunnerAdapter', () => {
  it('does not persist raw terminal worker exception details', async () => {
    const secretMarker = 'redis://document-user:document-password@redis.invalid:6379';
    const updates: Array<{ status: string; error?: unknown }> = [];
    const documentJob = { id: 'document-job-1', snapshotId: 'snapshot-1' };
    const prisma = {
      documentJob: {
        findUnique: jest.fn(async () => ({ ...documentJob, status: 'QUEUED' })),
        update: jest.fn(async ({ data }: { data: { status: string; error?: unknown } }) => {
          updates.push(data);
          return { ...documentJob, ...data };
        }),
        updateMany: jest.fn(async ({ data }: {
          where: { id: string; status: string };
          data: { status: string; error?: unknown; failedAt?: Date };
        }) => {
          updates.push(data);
          return { count: 1 };
        }),
      },
      reviewedReportSnapshot: {
        findUnique: jest.fn<() => Promise<unknown>>()
          .mockResolvedValue({ id: 'snapshot-1', analysisId: 'analysis-1' }),
      },
      impactAnalysis: {
        findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({ id: 'analysis-1' }),
      },
      $transaction: jest.fn(),
    };
    const contextAdapter = {
      buildContext: jest.fn<() => Promise<unknown>>().mockRejectedValue(new Error(secretMarker)),
    };
    const adapter = new RuntimeDocumentJobRunnerAdapter(
      prisma as unknown as PrismaService,
      { build: jest.fn() } as never,
      { upsertApproved: jest.fn() } as never,
      contextAdapter as never,
    );

    await expect(adapter.run({
      documentJobId: documentJob.id,
      attemptNumber: 1,
      maxAttempts: 1,
    })).rejects.toThrow(secretMarker);

    const terminalUpdate = updates.find((update) => update.status === 'FAILED');
    expect(prisma.documentJob.updateMany).toHaveBeenCalledWith({
      where: { id: documentJob.id, status: 'RUNNING' },
      data: { status: 'FAILED', error: { code: 'DOCUMENT_GENERATION_FAILED' }, failedAt: expect.any(Date) },
    });
    expect(JSON.stringify(terminalUpdate?.error)).not.toContain(secretMarker);
    expect(terminalUpdate?.error).toEqual({ code: 'DOCUMENT_GENERATION_FAILED' });
  });

  it('does not reopen a completed job when a stale running read resumes', async () => {
    const documentJob = { id: 'document-job-1', snapshotId: 'snapshot-1' };
    const completedJob = {
      ...documentJob,
      status: 'COMPLETED',
      generatedDocumentId: 'approved-document-1',
    };
    const findUnique = jest.fn<() => Promise<unknown>>()
      .mockResolvedValueOnce({ ...documentJob, status: 'RUNNING' })
      .mockResolvedValueOnce(completedJob);
    const prisma = {
      documentJob: {
        findUnique,
        update: jest.fn(async () => ({ ...documentJob, status: 'RUNNING' })),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      reviewedReportSnapshot: {
        findUnique: jest.fn<() => Promise<unknown>>()
          .mockResolvedValue({ id: 'snapshot-1', analysisId: 'analysis-1' }),
      },
      impactAnalysis: {
        findUnique: jest.fn<() => Promise<unknown>>()
          .mockResolvedValue({ id: 'analysis-1' }),
      },
    };
    const contextAdapter = {
      buildContext: jest.fn<() => Promise<unknown>>()
        .mockRejectedValue(new Error('stale worker must not render')),
    };
    const adapter = new RuntimeDocumentJobRunnerAdapter(
      prisma as unknown as PrismaService,
      { build: jest.fn() } as never,
      { upsertApproved: jest.fn() } as never,
      contextAdapter as never,
    );

    await expect(adapter.run({ documentJobId: documentJob.id }))
      .resolves.toMatchObject({ success: true, generatedDocumentId: 'approved-document-1' });
    expect(contextAdapter.buildContext).not.toHaveBeenCalled();
  });

  it('keeps a retryable job running so the next BullMQ attempt can finish it', async () => {
    let status = 'QUEUED';
    const documentJob = { id: 'document-job-1', snapshotId: 'snapshot-1' };
    let generatedDocumentId: string | null = null;
    let generatedDocumentAnalysisId: string | null = null;
    const transaction = {
      documentJob: {
        updateMany: jest.fn(async ({ data }: {
          where: { id: string; status: string };
          data: { status: string; progress?: number; completedAt?: Date };
        }) => {
          status = data.status;
          return { count: 1 };
        }),
        update: jest.fn(async ({ data }: {
          where: { id: string };
          data: { generatedDocumentId?: string; generatedDocumentAnalysisId?: string };
        }) => {
          generatedDocumentId = data.generatedDocumentId ?? generatedDocumentId;
          generatedDocumentAnalysisId = data.generatedDocumentAnalysisId ?? generatedDocumentAnalysisId;
          return { ...documentJob, status, generatedDocumentId, generatedDocumentAnalysisId };
        }),
        findUnique: jest.fn(async () => ({
          ...documentJob,
          status,
          generatedDocumentId,
          generatedDocumentAnalysisId,
        })),
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
        updateMany: jest.fn(async ({ where, data }: {
          where: { id: string; status: string };
          data: { status: string };
        }) => {
          if (status !== where.status) return { count: 0 };
          status = data.status;
          return { count: 1 };
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
      upsertApproved: jest.fn<(
        params: { impactAnalysisId: string; reviewedReportSnapshotId: string; content: string },
        transaction: unknown,
      ) => Promise<{ id: string; content: string }>>()
        .mockResolvedValue({ id: 'approved-document-1', content: '# Persisted approved report' }),
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
    expect(documentRepo.upsertApproved).toHaveBeenCalledWith(
      expect.objectContaining({
        impactAnalysisId: 'analysis-1',
        reviewedReportSnapshotId: 'snapshot-1',
        content: '# Approved report',
      }),
      transaction,
    );
    expect(transaction.documentJob.updateMany).toHaveBeenCalledWith({
      where: { id: documentJob.id, status: 'RUNNING' },
      data: { status: 'COMPLETED', progress: 100, completedAt: expect.any(Date) },
    });
    expect(transaction.documentJob.update).toHaveBeenCalledWith({
      where: { id: documentJob.id },
      data: {
        generatedDocumentId: 'approved-document-1',
        generatedDocumentAnalysisId: 'analysis-1',
      },
    });
    expect(transaction.reviewedReportSnapshot.update).toHaveBeenCalledWith({
      where: { id: 'snapshot-1' },
      data: {
        approvedDocumentId: 'approved-document-1',
        approvedDocumentAnalysisId: 'analysis-1',
        markdown: '# Persisted approved report',
      },
    });
  });
});
