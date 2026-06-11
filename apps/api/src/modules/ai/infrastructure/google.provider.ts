import { Injectable, Inject } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { LlmProvider, LlmRequest, LlmResult } from '../domain/llm-provider.interface';
import { AiConfig, AI_CONFIG_TOKEN } from '../domain/ai-config';

@Injectable()
export class GoogleLlmProvider extends LlmProvider {
  readonly providerName = 'google';
  private readonly client: GoogleGenerativeAI;

  constructor(@Inject(AI_CONFIG_TOKEN) private config: AiConfig) {
    super();
    this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
  }

  async generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>> {
    const model = request.options?.model ?? this.config.defaultModel;
    const start = Date.now();
    const genModel = this.client.getGenerativeModel({ model });

    const result = await genModel.generateContent({
      systemInstruction: request.systemPrompt,
      contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: request.options?.temperature ?? this.config.temperature,
        maxOutputTokens: request.options?.maxTokens ?? this.config.maxTokens,
      },
    });

    const raw = JSON.parse(result.response.text());
    const data = schema.parse(raw);

    return {
      data,
      metadata: {
        provider: 'google',
        model,
        promptVersion: '',
        durationMs: Date.now() - start,
      },
    };
  }
}
