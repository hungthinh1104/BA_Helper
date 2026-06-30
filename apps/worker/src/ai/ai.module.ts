import { Module, DynamicModule } from '@nestjs/common';
import { AiConfig, resolveAiConfig } from '@ba-helper/shared';
import { LlmProviderPort } from '@ba-helper/application';
import { AI_CONFIG_TOKEN } from './ai-config';
import { FakeLlmProvider } from './fake-ai.provider';
import { OpenAiLlmProvider } from './openai.provider';
import { AnthropicLlmProvider } from './anthropic.provider';
import { GoogleLlmProvider } from './google.provider';
import { DeepseekLlmProvider } from './deepseek.provider';

/**
 * Worker-local AiModule — mirrors the API AiModule
 * but does NOT import from it. Providers use @ba-helper/application and
 * @ba-helper/shared directly.
 */
@Module({})
export class AiModule {
  static forRoot(config?: Partial<AiConfig>): DynamicModule {
    const envConfig = resolveAiConfig(process.env);

    const resolvedConfig: AiConfig = {
      ...envConfig,
      ...config,
    };

    return {
      module: AiModule,
      global: true,
      providers: [
        { provide: AI_CONFIG_TOKEN, useValue: resolvedConfig },
        {
          provide: LlmProviderPort,
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
      exports: [LlmProviderPort, AI_CONFIG_TOKEN],
    };
  }
}
