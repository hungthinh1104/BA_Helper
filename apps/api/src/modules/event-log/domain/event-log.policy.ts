export const EventLogPolicy = {
  validateIdempotencyKey: () => {
    // TODO: enforce unique idempotency keys for retryable events.
  },
};
