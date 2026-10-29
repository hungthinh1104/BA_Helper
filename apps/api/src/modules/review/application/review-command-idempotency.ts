import { AppError } from '@ba-helper/shared';
import type { Prisma } from '@prisma/client';
import type { EventLogService } from '@ba-helper/backend-runtime';

export async function recordReviewEvent(
  eventLog: EventLogService,
  transaction: Prisma.TransactionClient,
  params: {
    eventType: string;
    analysisId: string;
    itemId: string;
    state: string;
    requestKey: string;
    commandFingerprint: string;
    actorId: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await eventLog.recordEvent({
    eventType: params.eventType,
    idempotencyKey: reviewCommandIdempotencyKey(
      params.analysisId,
      params.itemId,
      params.requestKey,
    ),
    payload: {
      ...params.payload,
      analysisId: params.analysisId,
      itemId: params.itemId,
      state: params.state,
      commandFingerprint: params.commandFingerprint,
    },
    actorUserId: params.actorId,
  }, transaction);
}

export async function hasReviewCommand(
  eventLog: EventLogService,
  transaction: Prisma.TransactionClient,
  params: {
    analysisId: string;
    itemId: string;
    requestKey: string;
    commandFingerprint: string;
  },
): Promise<boolean> {
  const event = await eventLog.findEventByIdempotencyKey(
    reviewCommandIdempotencyKey(params.analysisId, params.itemId, params.requestKey),
    transaction,
  );
  if (!event) return false;
  const payload = event.payload;
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload) ||
    !('commandFingerprint' in payload) ||
    payload.commandFingerprint !== params.commandFingerprint
  ) {
    throw new AppError(
      'REQUEST_KEY_MISMATCH',
      'Review request key was already used for a different command.',
    );
  }
  return true;
}

function reviewCommandIdempotencyKey(
  analysisId: string,
  itemId: string,
  requestKey: string,
): string {
  return `impact:${analysisId}:review-item:${itemId}:command:${requestKey}`;
}
