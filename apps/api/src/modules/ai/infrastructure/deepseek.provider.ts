import { Injectable, Inject } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import { LlmProvider, LlmRequest, LlmResult } from '../domain/llm-provider.interface';
import { AiConfig, AI_CONFIG_TOKEN } from '../domain/ai-config';
import { parseStructuredLlmOutput } from './structured-output';

@Injectable()
export class DeepseekLlmProvider extends LlmProvider {
  readonly providerName = 'deepseek';
  private readonly client: OpenAI;

  constructor(@Inject(AI_CONFIG_TOKEN) private config: AiConfig) {
    super();
    this.client = new OpenAI({ 
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY 
    });
  }

  async generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>> {
    const model = request.options?.model ?? process.env.DEEPSEEK_MODEL ?? this.config.defaultModel;
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

    // DeepSeek might return extra text around JSON if used with reasoning model or if it misbehaves
    const rawText = response.choices[0].message.content;
    const { data, parseMode, rawLength, jsonLength } = parseStructuredLlmOutput({
      rawText,
      schema,
      allowJsonExtraction: true, // safe fallback
    });

    return {
      data,
      metadata: {
        provider: 'deepseek',
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
