import { EventLogRepository } from '../infrastructure/event-log.repository';
import { EventLogPolicy } from '../domain/event-log.policy';

export class EventLogService {
  constructor(private readonly repository: EventLogRepository) {}

  async recordEvent(params: {
    eventType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    actorUserId?: string;
  }): Promise<void> {
    const actorUserId = params.actorUserId || 'SYSTEM';

    EventLogPolicy.validateEventPayload({
      eventType: params.eventType,
      actorUserId,
      idempotencyKey: params.idempotencyKey,
      isRetryable: false, // Or derive from context
      metadata: params.payload,
    });
    
    await this.repository.createEvent({
      ...params,
      payload: { ...params.payload, actorUserId }
    });
  }
}
