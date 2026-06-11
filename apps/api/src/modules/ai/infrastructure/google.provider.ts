import { Injectable, Inject } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { LlmProvider, LlmRequest, LlmResult } from '../domain/llm-provider.interface';
import { AiConfig, AI_CONFIG_TOKEN } from '../domain/ai-config';
import { AiPolicy } from '../domain/ai.policy';
import { parseStructuredLlmOutput } from './structured-output';
import { AppError } from '../../../shared/app-error';

@Injectable()
export class GoogleLlmProvider extends LlmProvider {
  readonly providerName = 'google';
  private readonly client: GoogleGenerativeAI;

  constructor(@Inject(AI_CONFIG_TOKEN) private config: AiConfig) {
    super();
    // Priority: GOOGLE_API_KEY > GEMINI_API_KEY > GOOGLE_AI_API_KEY
    const apiKey =
      process.env.GOOGLE_API_KEY ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      throw new AppError(
        'AI_PROVIDER_AUTH_FAILED',
        'Google LLM provider requires GOOGLE_API_KEY, GEMINI_API_KEY, or GOOGLE_AI_API_KEY to be set.',
      );
    }

    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>> {
    const model = request.options?.model ?? this.config.defaultModel;
    const promptVersion = request.options?.promptVersion ?? '';
    const start = Date.now();

    // Invariant #11: Redact secrets from evidence before sending to real provider
    const safeUserPrompt = this.config.redactSecrets
      ? AiPolicy.redactPayload(request.userPrompt).redactedPayload
      : request.userPrompt;

    const genModel = this.client.getGenerativeModel({ model });

    const result = await genModel.generateContent({
      systemInstruction: request.systemPrompt,
      contents: [{ role: 'user', parts: [{ text: safeUserPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: request.options?.temperature ?? this.config.temperature,
        maxOutputTokens: request.options?.maxTokens ?? this.config.maxTokens,
      },
    });

    const rawText = result.response.text();
    const finishReason = result.response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.warn(`[GoogleLlmProvider] Unexpected finishReason: ${finishReason}`);
    }

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
        promptVersion,
        durationMs: Date.now() - start,
        parseMode,
        rawLength,
        jsonLength,
        inputTokens: result.response.usageMetadata?.promptTokenCount,
        outputTokens: result.response.usageMetadata?.candidatesTokenCount,
      },
    };
  }
}
