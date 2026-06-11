export interface AiConfig {
  provider: 'fake' | 'openai' | 'anthropic' | 'google';
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  /** Có bật secret redaction không (always true in prod) */
  redactSecrets: boolean;
}

export const AI_CONFIG_TOKEN = Symbol('AI_CONFIG');
