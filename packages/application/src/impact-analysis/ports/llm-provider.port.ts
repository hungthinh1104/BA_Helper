import { z } from 'zod';

export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  options?: LlmRequestOptions;
}

export interface LlmRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  promptVersion?: string;
}

export interface LlmCallMetadata {
  provider: string;
  model: string;
  promptVersion: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  parseMode?: 'raw' | 'extracted';
  rawLength?: number;
  jsonLength?: number;
}

export interface LlmResult<T> {
  data: T;
  metadata: LlmCallMetadata;
}

export abstract class LlmProviderPort {
  abstract readonly providerName: string;

  abstract generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>>;
}
