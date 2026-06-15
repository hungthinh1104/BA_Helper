import { Module, DynamicModule } from '@nestjs/common';
import { LlmProvider } from './domain/llm-provider.interface';
import { AiConfig, AI_CONFIG_TOKEN } from './domain/ai-config';
import { FakeLlmProvider } from './infrastructure/fake-ai.provider';
import { OpenAiLlmProvider } from './infrastructure/openai.provider';
import { AnthropicLlmProvider } from './infrastructure/anthropic.provider';
import { GoogleLlmProvider } from './infrastructure/google.provider';
import { DeepseekLlmProvider } from './infrastructure/deepseek.provider';

const AI_PROVIDERS = ['fake', 'openai', 'anthropic', 'google', 'deepseek'] as const;

export function resolveAiProvider(rawProvider?: string): AiConfig['provider'] {
  const provider = (rawProvider ?? 'fake').trim().toLowerCase();
  if ((AI_PROVIDERS as readonly string[]).includes(provider)) {
    return provider as AiConfig['provider'];
  }
  throw new Error(`Unsupported AI_PROVIDER "${rawProvider}". Expected one of: ${AI_PROVIDERS.join(', ')}.`);
}

@Module({})
export class AiModule {
  static forRoot(config?: Partial<AiConfig>): DynamicModule {
    const provider = resolveAiProvider(process.env.AI_PROVIDER ?? config?.provider);

    if (process.env.NODE_ENV === 'production' && provider === 'fake') {
      throw new Error('FakeLlmProvider is forbidden in production. Please set AI_PROVIDER.');
    }

    let defaultModel = process.env.AI_MODEL ?? config?.defaultModel;
    if (!defaultModel) {
      switch (provider) {
        case 'google': defaultModel = process.env.GOOGLE_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'; break;
        case 'anthropic': defaultModel = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022'; break;
        case 'openai': defaultModel = process.env.OPENAI_MODEL ?? 'gpt-4o'; break;
        case 'deepseek': defaultModel = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'; break;
        default: defaultModel = 'gpt-4o';
      }
    }

    const resolvedConfig: AiConfig = {
      provider,
      defaultModel,
      temperature: Number(process.env.AI_TEMPERATURE ?? config?.temperature ?? 0.2),
      maxTokens: Number(process.env.AI_MAX_TOKENS ?? config?.maxTokens ?? 8192),
      redactSecrets: process.env.NODE_ENV !== 'test',
    };

    return {
      module: AiModule,
      global: true,  // available everywhere without re-importing
      providers: [
        { provide: AI_CONFIG_TOKEN, useValue: resolvedConfig },
        {
          provide: LlmProvider,
          useFactory: (cfg: AiConfig) => {
            switch (cfg.provider) {
              case 'openai':    return new OpenAiLlmProvider(cfg);
              case 'anthropic': return new AnthropicLlmProvider(cfg);
              case 'google':    return new GoogleLlmProvider(cfg);
              case 'deepseek':  return new DeepseekLlmProvider(cfg);
              case 'fake':
              default:          return new FakeLlmProvider();
            }
          },
          inject: [AI_CONFIG_TOKEN],
        },
      ],
      exports: [LlmProvider, AI_CONFIG_TOKEN],
    };
  }
}
