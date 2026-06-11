import { Module, DynamicModule } from '@nestjs/common';
import { LlmProvider } from './domain/llm-provider.interface';
import { AiConfig, AI_CONFIG_TOKEN } from './domain/ai-config';
import { FakeLlmProvider } from './infrastructure/fake-ai.provider';
import { OpenAiLlmProvider } from './infrastructure/openai.provider';
import { AnthropicLlmProvider } from './infrastructure/anthropic.provider';
import { GoogleLlmProvider } from './infrastructure/google.provider';
import { DeepseekLlmProvider } from './infrastructure/deepseek.provider';

@Module({})
export class AiModule {
  static forRoot(config?: Partial<AiConfig>): DynamicModule {
    const provider = (process.env.AI_PROVIDER as AiConfig['provider']) ?? config?.provider ?? 'fake';

    if (process.env.NODE_ENV === 'production' && provider === 'fake') {
      throw new Error('FakeLlmProvider is forbidden in production. Please set AI_PROVIDER.');
    }

    const resolvedConfig: AiConfig = {
      provider,
      defaultModel: process.env.AI_MODEL ?? config?.defaultModel ?? 'gpt-4o',
      temperature: Number(process.env.AI_TEMPERATURE ?? config?.temperature ?? 0.2),
      maxTokens: Number(process.env.AI_MAX_TOKENS ?? config?.maxTokens ?? 4096),
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
