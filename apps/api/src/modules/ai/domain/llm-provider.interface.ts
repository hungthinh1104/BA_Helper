import { z } from 'zod';

export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  /** Provider-specific overrides (temperature, model, max_tokens) */
  options?: LlmRequestOptions;
}

export interface LlmRequestOptions {
  model?: string;        // override default model
  temperature?: number;
  maxTokens?: number;
  promptVersion?: string; // propagated from renderPrompt() for audit metadata
}

export interface LlmCallMetadata {
  provider: string;      // 'openai' | 'anthropic' | 'google' | 'fake'
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

export abstract class LlmProvider {
  abstract readonly providerName: string;

  abstract generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>>;
}
