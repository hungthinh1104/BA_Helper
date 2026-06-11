import { EventLogRepository } from '../infrastructure/event-log.repository';

export class EventLogService {
  constructor(private readonly repository: EventLogRepository) {}

  async recordEvent(params: {
    eventType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.repository.createEvent(params);
  }
}
