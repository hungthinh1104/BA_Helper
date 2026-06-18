import { AppError } from '../../../shared/app-error';
import {
  extractRetryAfterMs,
  isEmbeddingRateLimitError,
  mapWithConcurrency,
  withEmbeddingRetry,
} from './embedding-retry-policy';
import { resolveEmbeddingProfile } from './embedding-profile-registry';

describe('embedding-retry-policy', () => {
  it('retries on 429 and eventually succeeds', async () => {
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');
    const sleep = jest.fn().mockResolvedValue(undefined);
    const operation = jest
      .fn()
      .mockRejectedValueOnce({ status: 429, message: 'Too Many Requests' })
      .mockResolvedValue('ok');

    const result = await withEmbeddingRetry(
      {
        provider: 'google',
        model: profile.model,
        profile,
        sleep,
        random: () => 0,
      },
      operation,
    );

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('respects Retry-After header when provided', async () => {
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');
    const sleep = jest.fn().mockResolvedValue(undefined);

    await withEmbeddingRetry(
      {
        provider: 'google',
        model: profile.model,
        profile,
        sleep,
        random: () => 0,
      },
      jest
        .fn()
        .mockRejectedValueOnce({
          status: 429,
          headers: { 'retry-after': '2' },
          message: 'quota',
        })
        .mockResolvedValue('ok'),
    );

    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('stops after max retries and throws EMBEDDING_RATE_LIMITED', async () => {
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');
    const sleep = jest.fn().mockResolvedValue(undefined);

    await expect(
      withEmbeddingRetry(
        {
          provider: 'google',
          model: profile.model,
          profile: { ...profile, maxRetries: 1 },
          sleep,
          random: () => 0,
        },
        jest.fn().mockRejectedValue({
          status: 429,
          message: 'Too Many Requests',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'EMBEDDING_RATE_LIMITED',
    });

    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-retryable dimension mismatch errors', async () => {
    const profile = resolveEmbeddingProfile('google-gemini-001-1536');
    const sleep = jest.fn().mockResolvedValue(undefined);
    const error = new AppError(
      'EMBEDDING_DIMENSION_MISMATCH',
      'wrong dimension',
    );
    const operation = jest
      .fn()
      .mockRejectedValue(error);

    await expect(
      withEmbeddingRetry(
        {
          provider: 'google',
          model: profile.model,
          profile,
          sleep,
        },
        operation,
      ),
    ).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('detects common rate-limit errors and retry-after values', () => {
    expect(isEmbeddingRateLimitError({ status: 429, message: 'quota' })).toBe(
      true,
    );
    expect(
      extractRetryAfterMs({
        response: { headers: { 'Retry-After': '3' } },
      }),
    ).toBe(3000);
  });

  it('limits concurrent worker execution', async () => {
    let active = 0;
    let maxActive = 0;

    await mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return item * 2;
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
