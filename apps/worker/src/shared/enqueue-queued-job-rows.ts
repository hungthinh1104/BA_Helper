export async function enqueueQueuedRows(
  queueName: string,
  findPage: (cursor?: string) => Promise<Array<{ id: string }>>,
  enqueue: (id: string) => Promise<void>,
  batchSize: number,
): Promise<number> {
  let total = 0;
  let cursor: string | undefined;

  while (true) {
    const rows = await findPage(cursor);
    for (const row of rows) {
      try {
        await enqueue(row.id);
      } catch {
        throw new QueueEnqueueFailure(queueName, row.id);
      }
    }
    total += rows.length;
    if (rows.length < batchSize) return total;
    cursor = rows[rows.length - 1].id;
  }
}

export class QueueEnqueueFailure extends Error {
  constructor(
    readonly queueName: string,
    readonly jobId: string,
  ) {
    super('A persisted queued job could not be delivered to BullMQ.');
  }
}
