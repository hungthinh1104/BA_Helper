import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { createTestApp } from './helpers/test-app';

describe('E2E BullMQ prefix cleanup', () => {
  let app: INestApplication | undefined;
  let observedQueues: Queue[] = [];
  let protectedQueue: Queue | undefined;
  let observedJobs: Array<{ queue: Queue; id: string }> = [];
  let protectedJobId: string | undefined;

  afterEach(async () => {
    if (app) await app.close();
    for (const queue of [...observedQueues, protectedQueue].filter((item): item is Queue => Boolean(item))) {
      if (!queue) continue;
      try {
        await queue.obliterate({ force: true });
      } finally {
        await queue.close();
      }
    }
    app = undefined;
    observedQueues = [];
    protectedQueue = undefined;
    observedJobs = [];
    protectedJobId = undefined;
  });

  it('removes every app queue prefix on close and preserves another E2E prefix', async () => {
    app = await createTestApp();
    const redisUrl = process.env.REDIS_URL_TEST;
    if (!redisUrl) throw new Error('REDIS_URL_TEST is required.');

    const prefix = process.env.BULLMQ_PREFIX;
    if (!prefix) throw new Error('The E2E app must use a BullMQ prefix.');

    const queueNames = ['impact-analysis', 'embedding', 'scan-job', 'document-job'];
    for (const name of queueNames) {
      const appQueue = app.get<Queue>(`BullQueue_${name}`);
      const observedQueue = new Queue(name, {
        connection: { url: redisUrl },
        prefix,
      });
      observedQueues.push(observedQueue);
      await observedQueue.waitUntilReady();
      const id = `cleanup-${name}-${randomUUID()}`;
      await appQueue.add('cleanup-probe', { marker: name }, { jobId: id });
      observedJobs.push({ queue: observedQueue, id });
    }
    protectedQueue = new Queue('document-job', {
      connection: { url: redisUrl },
      prefix: `ba-helper-e2e-protected-${randomUUID()}`,
    });
    await protectedQueue.waitUntilReady();
    protectedJobId = `preserve-${randomUUID()}`;
    await protectedQueue.add('cleanup-probe', { marker: 'other-prefix' }, { jobId: protectedJobId });

    await app.close();
    app = undefined;

    for (const observed of observedJobs) {
      await expect(observed.queue.getJob(observed.id)).resolves.toBeUndefined();
    }
    await expect(protectedQueue.getJob(protectedJobId)).resolves.toBeDefined();
  });
});
