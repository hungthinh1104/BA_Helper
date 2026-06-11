import { Injectable, Inject } from '@nestjs/common';
import OpenAI from 'openai';
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

    const response = await this.client.chat.completions.create({
      model,
      temperature: request.options?.temperature ?? this.config.temperature,
      max_tokens: request.options?.maxTokens ?? this.config.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
    });

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
