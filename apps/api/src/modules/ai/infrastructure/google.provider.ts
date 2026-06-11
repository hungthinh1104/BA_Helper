import { Injectable, Inject } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { LlmProvider, LlmRequest, LlmResult } from '../domain/llm-provider.interface';
import { AiConfig, AI_CONFIG_TOKEN } from '../domain/ai-config';
import { parseStructuredLlmOutput } from './structured-output';

@Injectable()
export class GoogleLlmProvider extends LlmProvider {
  readonly providerName = 'google';
  private readonly client: GoogleGenerativeAI;

  constructor(@Inject(AI_CONFIG_TOKEN) private config: AiConfig) {
    super();
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '');
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

    const rawText = result.response.text();
    console.log('Gemini finishReason:', result.response.candidates?.[0]?.finishReason);
    const { data, parseMode, rawLength, jsonLength } = parseStructuredLlmOutput({
      rawText,
      schema,
      allowJsonExtraction: false, // Gemini guarantees JSON via responseMimeType
    });

    return {
      data,
      metadata: {
        provider: 'google',
        model,
        promptVersion: '',
        durationMs: Date.now() - start,
        parseMode,
        rawLength,
        jsonLength,
      },
    };
  }
}
