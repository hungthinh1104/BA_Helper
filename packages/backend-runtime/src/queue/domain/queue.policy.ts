import { AppError } from '@ba-helper/shared';

export const QueuePolicy = {
  assertRetryableJob: (params: {
    jobType: string;
    idempotencyKey?: string | null;
    attempt: number;
    maxAttempts: number;
    payload: Record<string, any>;
  }) => {
    if (!params.idempotencyKey) {
      throw new AppError('QUEUE_MISSING_IDEMPOTENCY_KEY', `Retryable job ${params.jobType} must have an idempotency key.`);
    }

    if (params.attempt > params.maxAttempts) {
      throw new AppError('QUEUE_MAX_RETRIES_EXCEEDED', `Job ${params.jobType} exceeded max attempts (${params.maxAttempts}).`);
    }

    // Check for stable target identifiers based on job type if needed, 
    // or broadly enforce that payload must have an ID of some sort if we can guess it.
    // At minimum, payload cannot be empty if it's a processing job.
    if (!params.payload || Object.keys(params.payload).length === 0) {
      throw new AppError('QUEUE_EMPTY_PAYLOAD', `Job ${params.jobType} payload cannot be empty.`);
    }

    // specific checks for known jobs
    if (params.jobType === 'SCAN_REPOSITORY') {
      if (!params.payload.repositoryId) {
        throw new AppError('QUEUE_MISSING_TARGET', `Job SCAN_REPOSITORY payload must contain repositoryId.`);
      }
    } else if (params.jobType === 'RUN_IMPACT_ANALYSIS') {
      if (!params.payload.analysisId) {
        throw new AppError('QUEUE_MISSING_TARGET', `Job RUN_IMPACT_ANALYSIS payload must contain analysisId.`);
      }
    }
  },
};
