import type { EventLogRepository } from '../infrastructure/event-log.repository';
import { EventLogPolicy } from '@ba-helper/application';
import type { EventLogDto } from '@ba-helper/contracts';

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

  async getScanJobEvents(jobId: string): Promise<EventLogDto[]> {
    const events = await this.repository.findEventsByPrefixes([
      `scan-job:${jobId}:`,
      `scan:${jobId}:`
    ]);
    return events.map(this.mapToDto);
  }

  async getAnalysisEvents(analysisId: string): Promise<EventLogDto[]> {
    const events = await this.repository.findEventsByPrefixes([
      `analysis:${analysisId}:`,
      `impact:${analysisId}:`
    ]);
    return events.map(this.mapToDto);
  }

  private mapToDto(event: any): EventLogDto {
    const payload = event.payload || {};
    
    // Extract actor fields
    let actorType: 'SYSTEM' | 'USER' = 'SYSTEM';
    if (payload.actorType === 'USER' || payload.actorUserId !== 'system') {
      if (payload.actorUserId && payload.actorUserId !== 'system') {
        actorType = 'USER';
      }
    }
    
    const actorName = typeof payload.actorName === 'string' ? payload.actorName : null;
    const triggeredByUserId = typeof payload.triggeredByUserId === 'string' ? payload.triggeredByUserId : null;

    // Build allowlisted metadata
    const metadata: Record<string, string | number | boolean | null> = {};
    const allowlist = [
      'artifactCount', 'evidenceCount', 'dependencyEdgeCount', 'skippedDependencyEdgeCount',
      'insightCount', 'unknownCount', 'traceabilityLinkCount', 'provider',
      'inputTokens', 'outputTokens', 'totalTokens', 'indexStatus', 'previousStatus',
      'nextStatus', 'phase', 'errorCode', 'errorMessage'
    ];

    for (const key of allowlist) {
      if (payload[key] !== undefined) {
        if (typeof payload[key] === 'string' || typeof payload[key] === 'number' || typeof payload[key] === 'boolean' || payload[key] === null) {
          metadata[key] = payload[key];
        } else if (payload[key] && typeof payload[key] === 'object') {
          // If it's an object, we can't expose it directly based on contract. Skip or stringify?
          // The blocklist prevents full diagnostics, full response, etc.
          // Wait, 'provider', 'inputTokens' might be inside payload.llm.
          // Let's flatten specific known nested fields if needed, but the current payload puts them flat or nested?
        }
      }
    }

    // Special handling for token usage if nested
    if (payload.llm && typeof payload.llm === 'object') {
      if (payload.llm.provider) metadata.provider = String(payload.llm.provider);
      if (typeof payload.llm.inputTokens === 'number') metadata.inputTokens = payload.llm.inputTokens;
      if (typeof payload.llm.outputTokens === 'number') metadata.outputTokens = payload.llm.outputTokens;
      if (typeof payload.llm.totalTokens === 'number') metadata.totalTokens = payload.llm.totalTokens;
    }

    return {
      id: event.id,
      eventType: event.eventType,
      idempotencyKey: event.idempotencyKey,
      actorType,
      actorName,
      triggeredByUserId,
      metadata,
      createdAt: event.createdAt.toISOString(),
    };
  }
}
