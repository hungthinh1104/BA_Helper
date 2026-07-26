import { QueuePolicy } from './queue.policy';

describe('QueuePolicy', () => {
  describe('assertRetryableJob', () => {
    it('throws if idempotency key is missing', () => {
      expect(() => {
        QueuePolicy.assertRetryableJob({
          jobType: 'TEST_JOB',
          idempotencyKey: null,
          attempt: 1,
          maxAttempts: 3,
          payload: { id: 1 },
        });
      }).toThrow('Retryable job TEST_JOB must have an idempotency key.');
    });

    it('throws if max attempts exceeded', () => {
      expect(() => {
        QueuePolicy.assertRetryableJob({
          jobType: 'TEST_JOB',
          idempotencyKey: 'key-123',
          attempt: 4,
          maxAttempts: 3,
          payload: { id: 1 },
        });
      }).toThrow('Job TEST_JOB exceeded max attempts (3).');
    });

    it('throws if payload is empty', () => {
      expect(() => {
        QueuePolicy.assertRetryableJob({
          jobType: 'TEST_JOB',
          idempotencyKey: 'key-123',
          attempt: 1,
          maxAttempts: 3,
          payload: {},
        });
      }).toThrow('Job TEST_JOB payload cannot be empty.');
    });

    it('throws if SCAN_REPOSITORY is missing repositoryId', () => {
      expect(() => {
        QueuePolicy.assertRetryableJob({
          jobType: 'SCAN_REPOSITORY',
          idempotencyKey: 'key-123',
          attempt: 1,
          maxAttempts: 3,
          payload: { someOtherField: true },
        });
      }).toThrow('Job SCAN_REPOSITORY payload must contain repositoryId.');
    });

    it('throws if RUN_IMPACT_ANALYSIS is missing analysisId', () => {
      expect(() => {
        QueuePolicy.assertRetryableJob({
          jobType: 'RUN_IMPACT_ANALYSIS',
          idempotencyKey: 'key-123',
          attempt: 1,
          maxAttempts: 3,
          payload: { repositoryId: 'abc' },
        });
      }).toThrow('Job RUN_IMPACT_ANALYSIS payload must contain analysisId.');
    });

    it('passes for valid job', () => {
      expect(() => {
        QueuePolicy.assertRetryableJob({
          jobType: 'RUN_IMPACT_ANALYSIS',
          idempotencyKey: 'key-123',
          attempt: 1,
          maxAttempts: 3,
          payload: { analysisId: 'uuid-123' },
        });
      }).not.toThrow();
    });
  });
});
