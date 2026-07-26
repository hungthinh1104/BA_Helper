import { AppError } from '@ba-helper/shared';
import { AiOutputError } from '@ba-helper/application';
import { classifyWorkerError } from './job-error-classifier';

describe('classifyWorkerError', () => {
  it('treats AI schema/parse failures as unrecoverable', () => {
    for (const code of [
      'AI_JSON_PARSE_FAILED',
      'AI_OUTPUT_SCHEMA_INVALID',
      'AI_OUTPUT_SCHEMA_VALIDATION_FAILED',
      'AI_OUTPUT_TRUNCATED',
      'AI_EMPTY_RESPONSE',
    ]) {
      expect(classifyWorkerError(new AiOutputError(code as never, 'bad output'))).toBe(
        'UNRECOVERABLE',
      );
    }
  });

  it('treats transient AI output errors as retryable', () => {
    expect(
      classifyWorkerError(new AiOutputError('AI_PROVIDER_TIMEOUT' as never, 'timeout')),
    ).toBe('RETRYABLE');
  });

  it('treats known terminal AppError codes as unrecoverable', () => {
    for (const code of [
      'AI_PROVIDER_AUTH_FAILED',
      'IMPACT_ANALYSIS_NOT_FOUND',
      'SCAN_JOB_NOT_FOUND',
      'SNAPSHOT_NOT_FOUND',
      'UNSUPPORTED_FRAMEWORK',
      'UNSUPPORTED_DOMAIN',
    ]) {
      expect(classifyWorkerError(new AppError(code as never, 'terminal'))).toBe(
        'UNRECOVERABLE',
      );
    }
  });

  it('treats transient AppError codes (e.g. rate limit / timeout) as retryable', () => {
    expect(
      classifyWorkerError(new AppError('AI_PROVIDER_RATE_LIMITED' as never, 'slow down')),
    ).toBe('RETRYABLE');
    expect(
      classifyWorkerError(new AppError('CLONE_FAILED' as never, 'network blip')),
    ).toBe('RETRYABLE');
  });

  it('falls back to retryable for unknown/untyped errors', () => {
    expect(classifyWorkerError(new Error('boom'))).toBe('RETRYABLE');
    expect(classifyWorkerError('nope')).toBe('RETRYABLE');
    expect(classifyWorkerError(undefined)).toBe('RETRYABLE');
  });
});
