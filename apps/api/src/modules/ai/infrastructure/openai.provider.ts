import { Injectable, Inject } from '@nestjs/common';
import OpenAI from 'openai';
import { AppError } from '../../../shared/app-error';
import { z } from 'zod';
import { LlmProvider, LlmRequest, LlmResult } from '../domain/llm-provider.interface';
import { AiConfig, AI_CONFIG_TOKEN } from '../domain/ai-config';
import { parseStructuredLlmOutput } from './structured-output';

@Injectable()
export class OpenAiLlmProvider extends LlmProvider {
  readonly providerName = 'openai';
  private readonly client: OpenAI;

  constructor(@Inject(AI_CONFIG_TOKEN) private config: AiConfig) {
    super();
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
          'OpenAI is temporarily unavailable or overloaded. Retry the analysis later or switch provider/model.'
        );
      }
      throw error;
    }

    const rawText = response.choices[0].message.content;
    const { data, parseMode, rawLength, jsonLength } = parseStructuredLlmOutput({
      rawText,
      schema,
      allowJsonExtraction: true, // fallback extraction for safety
    });

    return {
      data,
      metadata: {
        provider: 'openai',
        model,
        promptVersion: '', // caller sets this
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
