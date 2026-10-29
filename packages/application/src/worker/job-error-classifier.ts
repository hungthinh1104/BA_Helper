import { AppError } from '@ba-helper/shared';
import { AiOutputError } from '../impact-analysis/ai/ai.errors';

export type JobErrorRecoverability = 'RETRYABLE' | 'UNRECOVERABLE';

/** Classifies worker failures so retryable jobs do not become terminal early. */
export function classifyWorkerError(error: unknown): JobErrorRecoverability {
  if (error instanceof AiOutputError) {
    const terminalAiCodes = new Set([
      'AI_JSON_PARSE_FAILED',
      'AI_OUTPUT_SCHEMA_INVALID',
      'AI_OUTPUT_SCHEMA_VALIDATION_FAILED',
      'AI_OUTPUT_TRUNCATED',
      'AI_EMPTY_RESPONSE',
    ]);
    return terminalAiCodes.has(error.code) ? 'UNRECOVERABLE' : 'RETRYABLE';
  }

  if (error instanceof AppError) {
    const terminalAppCodes = new Set([
      'AI_PROVIDER_AUTH_FAILED',
      'DOCUMENT_JOB_NOT_FOUND',
      'DOCUMENT_JOB_NOT_READY',
      'IMPACT_ANALYSIS_NOT_FOUND',
      'REPORT_PROVENANCE_MISMATCH',
      'REVIEWED_SNAPSHOT_MISSING',
      'SCAN_JOB_NOT_FOUND',
      'SNAPSHOT_NOT_FOUND',
      'UNSUPPORTED_FRAMEWORK',
      'UNSUPPORTED_DOMAIN',
      'UNSUPPORTED_DOMAIN_PACK',
      'UNSUPPORTED_DOMAIN_PACK_VERSION',
    ]);
    return terminalAppCodes.has(error.code) ? 'UNRECOVERABLE' : 'RETRYABLE';
  }

  return 'RETRYABLE';
}
