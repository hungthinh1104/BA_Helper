const EMBEDDING_PROVIDERS = ['fake', 'openai', 'google'] as const;
export type EmbeddingProviderName = (typeof EMBEDDING_PROVIDERS)[number];

export interface EmbeddingConfig {
  provider: EmbeddingProviderName;
  apiKey?: string;
}

export function resolveEmbeddingProvider(rawProvider?: string): EmbeddingProviderName {
  const provider = (rawProvider || 'fake').trim().toLowerCase();
  
  if ((EMBEDDING_PROVIDERS as readonly string[]).includes(provider)) {
    return provider as EmbeddingProviderName;
  }
  throw new Error(`Unsupported EMBEDDING_PROVIDER "${rawProvider}". Expected one of: ${EMBEDDING_PROVIDERS.join(', ')}.`);
}

export function resolveEmbeddingConfig(env: NodeJS.ProcessEnv): EmbeddingConfig {
  const provider = resolveEmbeddingProvider(env.EMBEDDING_PROVIDER);
  let apiKey: string | undefined;

  switch (provider) {
    case 'openai': apiKey = env.OPENAI_API_KEY; break;
    case 'google': apiKey = env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY ?? env.GOOGLE_AI_API_KEY; break;
  }

  return { provider, apiKey };
}
