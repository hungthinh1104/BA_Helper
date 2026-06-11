import { Injectable, Inject } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { LlmProvider, LlmRequest, LlmResult } from '../domain/llm-provider.interface';
import { AiConfig, AI_CONFIG_TOKEN } from '../domain/ai-config';
import { parseStructuredLlmOutput } from './structured-output';

@Injectable()
export class AnthropicLlmProvider extends LlmProvider {
  readonly providerName = 'anthropic';
  private readonly client: Anthropic;

  constructor(@Inject(AI_CONFIG_TOKEN) private config: AiConfig) {
    super();
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>> {
    const model = request.options?.model ?? this.config.defaultModel;
    const start = Date.now();

    const response = await this.client.messages.create({
      model,
      max_tokens: request.options?.maxTokens ?? this.config.maxTokens,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userPrompt }],
    });

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
