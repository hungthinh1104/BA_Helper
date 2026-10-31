import type { Prisma } from '@prisma/client';
import type { EventLogService, PrismaService } from '@ba-helper/backend-runtime';

export const STALE_JOB_ERROR_CODE = 'WORKER_JOB_ORPHANED';
export const STALE_JOB_ERROR_MESSAGE = 'The worker lease expired and no active queue job remains.';
const STALE_FAILURE_TRANSACTION_BATCH_SIZE = 25;

export interface StaleJobFailureParams {
  eventType: string;
  idempotencyKey: (id: string) => string;
  payload: (id: string) => Record<string, unknown>;
  update: (
    transaction: Prisma.TransactionClient,
    id: string,
  ) => Promise<{ count: number }>;
}

export async function failStaleRows(
  prisma: PrismaService,
  eventLog: EventLogService,
  ids: string[],
  params: StaleJobFailureParams,
): Promise<{ count: number }> {
  let count = 0;
  for (let offset = 0; offset < ids.length; offset += STALE_FAILURE_TRANSACTION_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + STALE_FAILURE_TRANSACTION_BATCH_SIZE);
    count += await prisma.$transaction(async (transaction) => {
      let transitioned = 0;
      for (const id of batch) {
        const result = await params.update(transaction, id);
        if (result.count === 0) continue;

        await eventLog.recordEvent({
          eventType: params.eventType,
          idempotencyKey: params.idempotencyKey(id),
          actorUserId: 'system',
          payload: {
            ...params.payload(id),
            previousStatus: 'RUNNING',
            nextStatus: 'FAILED',
            errorCode: STALE_JOB_ERROR_CODE,
            errorMessage: STALE_JOB_ERROR_MESSAGE,
          },
        }, transaction);
        transitioned += result.count;
      }
      return transitioned;
    });
  }
  return { count };
}
