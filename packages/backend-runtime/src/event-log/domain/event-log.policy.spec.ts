import { AppError } from '@ba-helper/shared';
import { EventLogPolicy } from './event-log.policy';

describe('EventLogPolicy', () => {
  describe('validateEventPayload', () => {
    it('throws if event type is unknown', () => {
      expect(() => {
        EventLogPolicy.validateEventPayload({
          eventType: 'UNKNOWN_EVENT',
          actorUserId: 'admin',
          isRetryable: false,
        });
      }).toThrow(new AppError('UNKNOWN_EVENT_TYPE', 'Event type UNKNOWN_EVENT is not recognized.'));
    });

    it('throws if actor is empty', () => {
      expect(() => {
        EventLogPolicy.validateEventPayload({
          eventType: 'SCAN_STARTED',
          actorUserId: '   ',
          isRetryable: false,
        });
      }).toThrow(new AppError('INVALID_ACTOR', 'Actor cannot be empty.'));
    });

    it('throws if actor string is too long', () => {
      expect(() => {
        EventLogPolicy.validateEventPayload({
          eventType: 'SCAN_STARTED',
          actorUserId: 'a'.repeat(101),
          isRetryable: false,
        });
      }).toThrow(new AppError('INVALID_ACTOR', 'Actor string exceeds 100 characters limit.'));
    });

    it('throws if metadata is too large', () => {
      expect(() => {
        EventLogPolicy.validateEventPayload({
          eventType: 'SCAN_STARTED',
          actorUserId: 'admin',
          isRetryable: false,
          metadata: { largeData: 'a'.repeat(10001) },
        });
      }).toThrow(new AppError('EVENT_METADATA_TOO_LARGE', 'Event metadata exceeds 10KB limit.'));
    });

    it('throws if idempotency key is missing for retryable event', () => {
      expect(() => {
        EventLogPolicy.validateEventPayload({
          eventType: 'ANALYSIS_STARTED',
          actorUserId: 'admin',
          isRetryable: true,
        });
      }).toThrow(new AppError('MISSING_IDEMPOTENCY_KEY', 'Retryable event ANALYSIS_STARTED must have an idempotency key.'));
    });

    it('throws if idempotency key has invalid format', () => {
      expect(() => {
        EventLogPolicy.validateEventPayload({
          eventType: 'ANALYSIS_STARTED',
          actorUserId: 'admin',
          idempotencyKey: 'invalid-key',
          isRetryable: false,
        });
      }).toThrow(new AppError('INVALID_IDEMPOTENCY_KEY', 'Idempotency key must follow a stable format like <domain>:<entityId>:<action>[:<version>].'));
    });

    it('passes for a valid event', () => {
      expect(() => {
        EventLogPolicy.validateEventPayload({
          eventType: 'SCAN_COMPLETED',
          actorUserId: 'system',
          idempotencyKey: 'scan:123:completed',
          isRetryable: false,
          metadata: { result: 'success' },
        });
      }).not.toThrow();
    });
  });
});
