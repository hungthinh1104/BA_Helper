import { Injectable, Inject } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '@ba-helper/shared';
import { z } from 'zod';
import { LlmProvider, LlmRequest, LlmResult } from '../domain/llm-provider.interface';
import { AiConfig, AI_CONFIG_TOKEN } from '../domain/ai-config';
import { parseStructuredLlmOutput } from './structured-output';
import { AiPolicy } from '@ba-helper/shared';

@Injectable()
export class AnthropicLlmProvider extends LlmProvider {
  readonly providerName = 'anthropic';
  private readonly client: Anthropic;

  constructor(@Inject(AI_CONFIG_TOKEN) private config: AiConfig) {
    super();
    this.client = new Anthropic({ apiKey: this.config.apiKey });
  }

  async generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>> {
    const model = request.options?.model ?? this.config.defaultModel;
    const start = Date.now();

    const safeUserPrompt = this.config.redactSecrets
      ? AiPolicy.redactPayload(request.userPrompt).redactedPayload
      : request.userPrompt;

    let response;
    try {
      response = await this.client.messages.create({
        model,
        max_tokens: request.options?.maxTokens ?? this.config.maxTokens,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: safeUserPrompt }],
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
          'Anthropic is temporarily unavailable or overloaded. Retry the analysis later or switch provider/model.'
        );
      }
      throw error;
    }

    const content = response.content[0];
    const rawText = content.type === 'text' ? content.text : undefined;
    
    const { data, parseMode, rawLength, jsonLength } = parseStructuredLlmOutput({
      rawText,
      schema,
      allowJsonExtraction: true, // Anthropic doesn't force JSON natively yet
    });

    return {
      data,
      metadata: {
        provider: 'anthropic',
        model,
        promptVersion: '',
        durationMs: Date.now() - start,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        parseMode,
        rawLength,
        jsonLength,
      },
    };
  }
}
