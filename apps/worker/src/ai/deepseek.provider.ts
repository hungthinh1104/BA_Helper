import { Injectable, Inject } from '@nestjs/common';
import OpenAI from 'openai';
import { AppError } from '@ba-helper/shared';
import { z } from 'zod';
import { LlmProviderPort, LlmRequest, LlmResult } from '@ba-helper/application';
import { AiConfig, AI_CONFIG_TOKEN } from './ai-config';
import { parseStructuredLlmOutput } from './structured-output';

@Injectable()
export class DeepseekLlmProvider extends LlmProviderPort {
  readonly providerName = 'deepseek';
  private readonly client: OpenAI;

  constructor(@Inject(AI_CONFIG_TOKEN) private config: AiConfig) {
    super();
    this.client = new OpenAI({
      baseURL: this.config.baseUrl,
      apiKey: this.config.apiKey,
    });
  }

  async generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>> {
    const model = request.options?.model ?? this.config.defaultModel;
    const start = Date.now();

    let response;
    try {
      response = await this.client.chat.completions.create({
        model,
        temperature: request.options?.temperature ?? this.config.temperature,
        max_tokens: request.options?.maxTokens ?? this.config.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
      });
    } catch (error: any) {
      const msg = error?.message?.toLowerCase() || '';
      if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota') || error?.status === 429) {
        throw new AppError('AI_PROVIDER_RATE_LIMITED', 'You have exceeded your AI provider rate limits. Please try again later or check your API quota.');
      }
      if (msg.includes('timeout') || msg.includes('abort') || msg.includes('network error') || msg.includes('fetch failed')) {
        throw new AppError('AI_PROVIDER_TIMEOUT', 'The AI provider timed out. Try analyzing again.');
      }
      if (
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('overload') ||
        msg.includes('unavailable') ||
        error?.status >= 500
      ) {
        throw new AppError(
          'AI_PROVIDER_UNAVAILABLE',
          'DeepSeek is temporarily unavailable or overloaded. Retry the analysis later or switch provider/model.'
        );
      }
      throw error;
    }

    // DeepSeek might return extra text around JSON
    const rawText = response.choices[0].message.content;
    const { data, parseMode, rawLength, jsonLength } = parseStructuredLlmOutput({
      rawText,
      schema,
      allowJsonExtraction: true,
    });

    return {
      data,
      metadata: {
        provider: 'deepseek',
        model,
        promptVersion: '',
        durationMs: Date.now() - start,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        parseMode,
        rawLength,
        jsonLength,
      },
    };
  }
}
