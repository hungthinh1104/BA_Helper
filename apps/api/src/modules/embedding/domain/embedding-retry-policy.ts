import { AppError } from '../../../shared/app-error';
import type { EmbeddingProfile } from './embedding-profile';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8_000;
const DEFAULT_JITTER_RATIO = 0.2;

export type EmbeddingRetryOptions = {
  provider: string;
  model: string;
  profile: EmbeddingProfile;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  logger?: (message: string) => void;
};

export function resolveEmbeddingMaxRetries(profile: EmbeddingProfile): number {
  return Math.max(0, profile.maxRetries ?? DEFAULT_MAX_RETRIES);
}

export function isEmbeddingRateLimitError(error: unknown): boolean {
  const status = readErrorStatus(error);
  if (status === 429) {
    return true;
  }

  const message = readErrorMessage(error).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('quota')
  );
}

export function extractRetryAfterMs(
  error: unknown,
  now: number = Date.now(),
): number | null {
  const rawValue =
    readHeader(error, 'retry-after') ??
    readHeader(error, 'Retry-After') ??
    null;

  if (!rawValue) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(rawValue)) {
    return Math.max(0, Math.round(Number(rawValue) * 1000));
  }

  const parsedDate = Date.parse(rawValue);
  if (Number.isNaN(parsedDate)) {
    return null;
  }

  return Math.max(0, parsedDate - now);
}

export async function withEmbeddingRetry<T>(
  options: EmbeddingRetryOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  const maxRetries = resolveEmbeddingMaxRetries(options.profile);
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isEmbeddingRateLimitError(error)) {
        throw error;
      }

      if (attempt >= maxRetries) {
        throw new AppError(
          'EMBEDDING_RATE_LIMITED',
          `Embedding provider rate limited after ${attempt + 1} attempt(s) for ${options.provider}/${options.model}.`,
          {
            provider: options.provider,
            model: options.model,
            profileId: options.profile.id,
            maxRetries,
          },
        );
      }

      const delayMs =
        extractRetryAfterMs(error, now()) ??
        computeBackoffDelayMs({ attempt, random });
      options.logger?.(
        `Embedding rate limited for ${options.provider}/${options.model}; retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1}).`,
      );
      attempt += 1;
      await sleep(delayMs);
    }
  }
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.trunc(concurrency) || 1);
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );
  return results;
}

function computeBackoffDelayMs(params: {
  attempt: number;
  random: () => number;
}): number {
  const exponential = Math.min(
    DEFAULT_BASE_DELAY_MS * 2 ** params.attempt,
    DEFAULT_MAX_DELAY_MS,
  );
  const jitter = exponential * DEFAULT_JITTER_RATIO * params.random();
  return Math.round(exponential + jitter);
}

function readErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const status =
    (error as { status?: unknown }).status ??
    (error as { response?: { status?: unknown } }).response?.status;

  return typeof status === 'number' ? status : null;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (!error || typeof error !== 'object') {
    return String(error ?? '');
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : String(error);
}

function readHeader(error: unknown, key: string): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const directHeaders = (error as { headers?: Record<string, unknown> }).headers;
  const responseHeaders = (error as {
    response?: { headers?: Record<string, unknown> };
  }).response?.headers;

  for (const headers of [directHeaders, responseHeaders]) {
    if (!headers || typeof headers !== 'object') {
      continue;
    }

    for (const [headerKey, value] of Object.entries(headers)) {
      if (headerKey.toLowerCase() !== key.toLowerCase()) {
        continue;
      }
      if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
      }
    }
  }

  return null;
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
