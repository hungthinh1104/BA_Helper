import { describe, expect, it, jest } from '@jest/globals';
import type { Job } from 'bullmq';
import { DocumentJobWorker } from './document-job.processor';

describe('DocumentJobWorker', () => {
  it('passes the current BullMQ attempt bounds into the document use case', async () => {
    const runDocumentJob = {
      execute: jest.fn<(params: { documentJobId: string; attemptNumber?: number; maxAttempts?: number }) => Promise<{ success: boolean }>>()
        .mockResolvedValue({ success: true }),
    };
    const worker = new DocumentJobWorker(runDocumentJob as never);
    const job = {
      id: 'doc-1',
      data: { documentJobId: 'document-job-1' },
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as Job<{ documentJobId: string }>;

    await worker.process(job);

    expect(runDocumentJob.execute).toHaveBeenCalledWith({
      documentJobId: 'document-job-1',
      attemptNumber: 2,
      maxAttempts: 3,
    });
  });
});
