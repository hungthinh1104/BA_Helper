import type { Queue } from 'bullmq';
import { isDeepStrictEqual } from 'node:util';

const RETRYABLE_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 1000 },
  // Keep failures available for inspection/retry while bounding dead-letter growth.
  removeOnFail: { age: 14 * 24 * 60 * 60, count: 5000 },
};

function assertJobIdentity(
  job: { name: string; data: unknown },
  name: string,
  data: Record<string, unknown>,
  jobId: string,
): void {
  if (job.name !== name || !isDeepStrictEqual(job.data, data)) {
    throw new Error(`BullMQ job ${jobId} already exists with a different name or payload.`);
  }
}

export async function enqueueRetryableJob(
  queue: Queue,
  name: string,
  data: Record<string, unknown>,
  jobId: string,
): Promise<void> {
  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    assertJobIdentity(existingJob, name, data, jobId);
  } else {
    let enqueueFailed = false;
    let enqueueError: unknown;
    try {
      await queue.add(name, data, { jobId, ...RETRYABLE_JOB_OPTIONS });
    } catch (error) {
      enqueueFailed = true;
      enqueueError = error;
    }

    // Confirm the stored record, not only add()'s response. BullMQ may resolve
    // add() after another producer wins the same deterministic job ID.
    let persistedJob;
    try {
      persistedJob = await queue.getJob(jobId);
    } catch (lookupError) {
      throw enqueueFailed ? enqueueError : lookupError;
    }
    if (!persistedJob) {
      if (enqueueFailed) throw enqueueError;
      throw new Error(`BullMQ job ${jobId} was not persisted after enqueue.`);
    }
    assertJobIdentity(persistedJob, name, data, jobId);
    return;
  }

  if (await existingJob.getState() !== 'failed') return;
  try {
    await existingJob.retry('failed');
  } catch (error) {
    // A concurrent delivery may already have moved the job out of failed.
    if (await existingJob.getState() === 'failed') throw error;
  }
}
