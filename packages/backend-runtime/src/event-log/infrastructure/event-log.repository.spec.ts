import { EventLogRepository } from './event-log.repository';
import type { EventLogTransactionClient } from './event-log.repository';

describe('EventLogRepository', () => {
  it('writes through the provided transaction client', async () => {
    const prismaUpsert = jest.fn();
    const transactionUpsert = jest.fn();
    const repository = new EventLogRepository({
      domainEvent: { upsert: prismaUpsert },
    } as any);
    const transaction = {
      domainEvent: { upsert: transactionUpsert },
    } as unknown as EventLogTransactionClient;
    const params = {
      eventType: 'REVIEWED_REPORT_SNAPSHOT_CREATED',
      idempotencyKey: 'reviewed-report-snapshot:snapshot-1:created',
      payload: { snapshotId: 'snapshot-1' },
    };

    await repository.createEvent(params, transaction);

    expect(transactionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: params.idempotencyKey },
      create: expect.objectContaining({
        eventType: params.eventType,
        idempotencyKey: params.idempotencyKey,
        payload: params.payload,
      }),
    }));
    expect(prismaUpsert).not.toHaveBeenCalled();
  });
});
