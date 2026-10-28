import { EventLogRepository } from './event-log.repository';
import type { EventLogTransactionClient } from './event-log.repository';

describe('EventLogRepository', () => {
  it('writes through the provided transaction client', async () => {
    const prismaCreateMany = jest.fn();
    const transactionCreateMany = jest.fn();
    const repository = new EventLogRepository({
      domainEvent: { createMany: prismaCreateMany },
    } as any);
    const transaction = {
      domainEvent: { createMany: transactionCreateMany },
    } as unknown as EventLogTransactionClient;
    const params = {
      eventType: 'REVIEWED_REPORT_SNAPSHOT_CREATED',
      idempotencyKey: 'reviewed-report-snapshot:snapshot-1:created',
      payload: { snapshotId: 'snapshot-1' },
    };

    await repository.createEvent(params, transaction);

    expect(transactionCreateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: params.eventType,
        idempotencyKey: params.idempotencyKey,
        payload: params.payload,
      }),
      skipDuplicates: true,
    });
    expect(prismaCreateMany).not.toHaveBeenCalled();
  });
});
