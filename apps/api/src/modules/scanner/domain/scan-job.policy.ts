import { AppError } from '@ba-helper/shared';

export const ScanJobPolicy = {
  validateRef: (ref?: string) => {
    if (!ref) return;
    if (ref.includes(' ') || ref.includes('..') || ref.includes('~')) {
      throw new AppError('INVALID_REPOSITORY_REF', 'Repository ref is invalid.');
    }
  },
  validateIdempotentRetry: (existingJobStatus: string) => {
    if (existingJobStatus === 'COMPLETED' || existingJobStatus === 'FAILED') {
      return { canReuse: true };
    }
    // If it is QUEUED or PROCESSING, we also return the existing one
    return { canReuse: true };
  },
};
