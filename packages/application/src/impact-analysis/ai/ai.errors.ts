export type AiOutputErrorCode =
  | 'AI_EMPTY_RESPONSE'
  | 'AI_JSON_PARSE_FAILED'
  | 'AI_OUTPUT_SCHEMA_INVALID'
  | 'AI_OUTPUT_SCHEMA_VALIDATION_FAILED'
  | 'AI_OUTPUT_TRUNCATED';

export class AiOutputError extends Error {
  constructor(
    public readonly code: AiOutputErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AiOutputError';
  }
}
