import { eventLogDtoSchema } from './src/event-log.contract';

describe('event log actor identity contract', () => {
  const event = {
    id: 'event-1',
    eventType: 'ANALYSIS_FINALIZED',
    idempotencyKey: 'analysis:1:finalized',
    actorType: 'USER',
    actorName: 'Reviewer',
    triggeredByUserId: 'user-1',
    metadata: {},
    createdAt: '2026-10-29T12:00:00.000Z',
  };

  it('rejects missing or unsupported actor type instead of inventing SYSTEM identity', () => {
    expect(eventLogDtoSchema.safeParse({ ...event, actorType: undefined }).success).toBe(false);
    expect(eventLogDtoSchema.safeParse({ ...event, actorType: 'SERVICE_ACCOUNT' }).success).toBe(false);
  });
});
