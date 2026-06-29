export interface EventLogPort {
  recordEvent(params: {
    eventType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    actorUserId?: string;
  }): Promise<void>;
}
