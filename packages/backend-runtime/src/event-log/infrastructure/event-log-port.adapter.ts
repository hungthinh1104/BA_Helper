import type { EventLogPort } from '@ba-helper/application';
import type { EventLogService } from '../application/event-log.service';

export class EventLogPortAdapter implements EventLogPort {
  constructor(private readonly service: EventLogService) {}

  async recordEvent(params: {
    eventType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    actorUserId?: string;
  }): Promise<void> {
    return this.service.recordEvent(params);
  }
}
