import type { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { AppError } from '@ba-helper/shared';
import { processWithClassification } from './classified-processing';

function fakeLogger() {
  return { log: jest.fn(), error: jest.fn() } as unknown as Logger & {
    log: jest.Mock;
    error: jest.Mock;
  };
}

const job = { id: 'job-1', attemptsMade: 2 };

describe('processWithClassification', () => {
  it('emits a completion metric with duration and attempt count on success', async () => {
    const logger = fakeLogger();
    await processWithClassification({
      logger,
      job,
      event: 'SCAN_JOB',
      context: { scanJobId: 's1' },
      run: async () => undefined,
    });

    expect((logger.log as jest.Mock)).toHaveBeenCalledTimes(1);
    const payload = JSON.parse((logger.log as jest.Mock).mock.calls[0][0]);
    expect(payload).toMatchObject({
      event: 'SCAN_JOB_COMPLETED',
      jobId: 'job-1',
      attemptsMade: 2,
      scanJobId: 's1',
    });
    expect(typeof payload.durationMs).toBe('number');
  });

  it('rethrows RETRYABLE errors unchanged so BullMQ retries', async () => {
    const logger = fakeLogger();
    const boom = new Error('transient');

    await expect(
      processWithClassification({
        logger,
        job,
        event: 'EMBEDDING_JOB',
        run: async () => {
          throw boom;
        },
      }),
    ).rejects.toBe(boom);

    const payload = JSON.parse((logger.error as jest.Mock).mock.calls[0][0]);
    expect(payload).toMatchObject({
      event: 'EMBEDDING_JOB_FAILED',
      recoverability: 'RETRYABLE',
    });
  });

  it('converts UNRECOVERABLE errors to BullMQ UnrecoverableError (no retry)', async () => {
    const logger = fakeLogger();

    await expect(
      processWithClassification({
        logger,
        job,
        event: 'SCAN_JOB',
        run: async () => {
          throw new AppError('SCAN_JOB_NOT_FOUND' as never, 'gone');
        },
      }),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    const payload = JSON.parse((logger.error as jest.Mock).mock.calls[0][0]);
    expect(payload).toMatchObject({
      event: 'SCAN_JOB_FAILED',
      recoverability: 'UNRECOVERABLE',
      errorCode: 'SCAN_JOB_NOT_FOUND',
    });
  });
});
