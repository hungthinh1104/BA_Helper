import { Module, DynamicModule } from '@nestjs/common';
import { AiConfig, resolveAiConfig } from '@ba-helper/shared';
import { LlmProvider } from './domain/llm-provider.interface';
import { AI_CONFIG_TOKEN } from './domain/ai-config';
import { FakeLlmProvider } from '../index';
import { OpenAiLlmProvider } from '../index';
import { AnthropicLlmProvider } from '../index';
import { GoogleLlmProvider } from '../index';
import { DeepseekLlmProvider } from '../index';

@Module({})
export class AiModule {
  static forRoot(config?: Partial<AiConfig>): DynamicModule {
    const envConfig = resolveAiConfig(process.env);
    
    // Allow manual overrides via config parameter
    const resolvedConfig: AiConfig = {
      ...envConfig,
      ...config,
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
