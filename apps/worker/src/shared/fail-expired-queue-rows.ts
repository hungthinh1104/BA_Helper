import { QueuePolicy } from '@ba-helper/application';

const QUEUE_INSPECTION_CONCURRENCY = 25;

interface StaleQueueRow {
  id: string;
  status: string;
  updatedAt: Date;
}

export async function failExpiredQueueRows(
  findPage: (cursor?: string) => Promise<StaleQueueRow[]>,
  failRows: (ids: string[]) => Promise<{ count: number }>,
  hasUnfinishedJob: (id: string) => Promise<boolean>,
  batchSize: number,
  cutoff: Date,
): Promise<number> {
  let failedCount = 0;
  let cursor: string | undefined;

  while (true) {
    const rows = await findPage(cursor);
    if (rows.length === 0) return failedCount;

    const unfinished: boolean[] = [];
    for (let offset = 0; offset < rows.length; offset += QUEUE_INSPECTION_CONCURRENCY) {
      const page = rows.slice(offset, offset + QUEUE_INSPECTION_CONCURRENCY);
      unfinished.push(...await Promise.all(page.map(({ id }) => hasUnfinishedJob(id))));
    }
    const expiredIds = rows
      .filter((row, index) => QueuePolicy.shouldFailStaleJob({
        status: row.status,
        updatedAt: row.updatedAt,
        cutoff,
        hasUnfinishedQueueJob: unfinished[index],
      }))
      .map(({ id }) => id);
    if (expiredIds.length > 0) {
      const result = await failRows(expiredIds);
      failedCount += result.count;
    }

    if (rows.length < batchSize) return failedCount;
    cursor = rows[rows.length - 1].id;
  }
}
