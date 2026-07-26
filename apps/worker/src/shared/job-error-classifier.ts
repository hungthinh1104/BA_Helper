import { AppError } from '@ba-helper/shared';
import { AiOutputError } from '@ba-helper/application';

/** Typed classification result for worker job failures. */
export type JobErrorRecoverability = 'RETRYABLE' | 'UNRECOVERABLE';

/**
 * Classifies a worker job error into RETRYABLE or UNRECOVERABLE.
 *
 * Priority: typed error codes → AppError codes → fallback heuristic.
 * No string-matching on error messages except as an explicit fallback boundary.
 * Shared by every worker processor (scan, embedding, impact-analysis, document)
 * so retry semantics are uniform.
 */
export function classifyWorkerError(error: unknown): JobErrorRecoverability {
  // 1. Typed AI output errors — schema/parse failures are unrecoverable on retry
  if (error instanceof AiOutputError) {
    const unrecoverableAiCodes = new Set([
      'AI_JSON_PARSE_FAILED',
      'AI_OUTPUT_SCHEMA_INVALID',
      'AI_OUTPUT_SCHEMA_VALIDATION_FAILED',
      'AI_OUTPUT_TRUNCATED',
      'AI_EMPTY_RESPONSE',
    ]);
    if (unrecoverableAiCodes.has(error.code)) {
      return 'UNRECOVERABLE';
    }
    return 'RETRYABLE';
  }

  // 2. Typed AppError codes — known unrecoverable states
  if (error instanceof AppError) {
    const unrecoverableAppCodes = new Set([
      'AI_PROVIDER_AUTH_FAILED',
      'IMPACT_ANALYSIS_NOT_FOUND',
      'SCAN_JOB_NOT_FOUND',
      'SNAPSHOT_NOT_FOUND',
      'UNSUPPORTED_FRAMEWORK',
      'UNSUPPORTED_DOMAIN',
      'UNSUPPORTED_DOMAIN_PACK',
      'UNSUPPORTED_DOMAIN_PACK_VERSION',
    ]);
    if (unrecoverableAppCodes.has(error.code)) {
      return 'UNRECOVERABLE';
    }
    return 'RETRYABLE';
  }

  // 3. Fallback: treat as retryable unless positively identified as unrecoverable.
  return 'RETRYABLE';
}
