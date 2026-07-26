import type { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import { classifyWorkerError } from './job-error-classifier';

/**
 * Runs a worker job body with uniform failure semantics + metrics:
 *  - RETRYABLE errors are rethrown so BullMQ retries (up to `attempts`).
 *  - UNRECOVERABLE errors are converted to BullMQ `UnrecoverableError` so they
 *    are NOT retried and go straight to the failed set.
 *  - Every run emits a structured metric log with processing duration and
 *    attempt count (success and failure), so retry counts and durations are
 *    observable per job type.
 */
export async function processWithClassification(params: {
  logger: Logger;
  job: Pick<Job, 'id' | 'attemptsMade'>;
  event: string;
  context?: Record<string, unknown>;
  run: () => Promise<unknown>;
}): Promise<void> {
  const startedAt = Date.now();
  const base = {
    jobId: params.job.id,
    attemptsMade: params.job.attemptsMade,
    ...(params.context ?? {}),
  };

  try {
    await params.run();
    params.logger.log(
      JSON.stringify({
        event: `${params.event}_COMPLETED`,
        ...base,
        durationMs: Date.now() - startedAt,
      }),
    );
  } catch (error: unknown) {
    const recoverability = classifyWorkerError(error);
    const errorCode =
      error instanceof Error && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    params.logger.error(
      JSON.stringify({
        event: `${params.event}_FAILED`,
        ...base,
        durationMs: Date.now() - startedAt,
        errorCode,
        errorName,
        recoverability,
      }),
    );

    if (recoverability === 'UNRECOVERABLE') {
      throw new UnrecoverableError(`[${errorCode ?? 'UNKNOWN'}] ${errorName}`);
    }
    throw error;
  }
}
