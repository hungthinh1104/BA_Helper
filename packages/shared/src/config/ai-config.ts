export interface AiConfig {
  provider: 'fake' | 'openai' | 'anthropic' | 'google' | 'deepseek';
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  /** Có bật secret redaction không (always true in prod) */
  redactSecrets: boolean;
  /** Configured API key if applicable */
  apiKey?: string;
  /** Configured base URL if applicable */
  baseUrl?: string;
}

const AI_PROVIDERS = ['fake', 'openai', 'anthropic', 'google', 'deepseek'] as const;

export function resolveAiProvider(rawProvider?: string): AiConfig['provider'] {
  const provider = (rawProvider ?? 'fake').trim().toLowerCase();
  if ((AI_PROVIDERS as readonly string[]).includes(provider)) {
    return provider as AiConfig['provider'];
  }
  throw new Error(`Unsupported AI_PROVIDER "${rawProvider}". Expected one of: ${AI_PROVIDERS.join(', ')}.`);
}

export function resolveAiConfig(env: NodeJS.ProcessEnv): AiConfig {
  const provider = resolveAiProvider(env.AI_PROVIDER);

  if (env.NODE_ENV === 'production' && provider === 'fake') {
    throw new Error('FakeLlmProvider is forbidden in production. Please set AI_PROVIDER.');
  }

  let defaultModel = env.AI_MODEL;
  if (!defaultModel) {
    switch (provider) {
      case 'google': defaultModel = env.GOOGLE_MODEL ?? env.GEMINI_MODEL ?? 'gemini-2.5-flash'; break;
      case 'anthropic': defaultModel = env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022'; break;
      case 'openai': defaultModel = env.OPENAI_MODEL ?? 'gpt-4o'; break;
      case 'deepseek': defaultModel = env.DEEPSEEK_MODEL ?? 'deepseek-chat'; break;
      default: defaultModel = 'gpt-4o';
    }
  }

  let apiKey: string | undefined;
  let baseUrl: string | undefined;

  switch (provider) {
    case 'openai': apiKey = env.OPENAI_API_KEY; break;
    case 'anthropic': apiKey = env.ANTHROPIC_API_KEY; break;
    case 'google': apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_AI_API_KEY; break;
    case 'deepseek':
      apiKey = env.DEEPSEEK_API_KEY;
      baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
      break;
  }

  return {
    provider,
    defaultModel,
    temperature: Number(env.AI_TEMPERATURE ?? 0.2),
    maxTokens: Number(env.AI_MAX_TOKENS ?? 8192),
    redactSecrets: env.NODE_ENV !== 'test',
    apiKey,
    baseUrl,
  };
}
