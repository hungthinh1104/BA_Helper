import { Injectable, Inject, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { LlmProvider, LlmRequest, LlmResult } from '../domain/llm-provider.interface';
import { AiConfig, AI_CONFIG_TOKEN } from '../domain/ai-config';
import { AiPolicy } from '../domain/ai.policy';
import { parseStructuredLlmOutput } from './structured-output';
import { AppError } from '../../../shared/app-error';
import { resolveGoogleProviderApiKey } from './google-provider-env';
import { AiOutputError } from '../domain/ai.errors';

@Injectable()
export class GoogleLlmProvider extends LlmProvider {
  readonly providerName = 'google';
  private readonly client: GoogleGenerativeAI;

  constructor(@Inject(AI_CONFIG_TOKEN) private config: AiConfig) {
    super();
    const apiKey = resolveGoogleProviderApiKey();

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

    let result;
    try {
      result = await genModel.generateContent({
        systemInstruction: request.systemPrompt,
        contents: [{ role: 'user', parts: [{ text: safeUserPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: request.options?.temperature ?? this.config.temperature,
          maxOutputTokens: request.options?.maxTokens ?? this.config.maxTokens,
        },
      });
    } catch (error: any) {
      const msg = error?.message?.toLowerCase() || '';
      if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
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
        msg.includes('unavailable')
      ) {
        throw new AppError(
          'AI_PROVIDER_UNAVAILABLE',
          'Gemini is temporarily unavailable or overloaded. Retry the analysis later or switch provider/model.'
        );
      }
      throw error;
    }

    const rawText = result.response.text();
    const finishReason = result.response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      new Logger('GoogleLlmProvider').warn(`Unexpected finishReason: ${finishReason}`);
    }

    if (finishReason === 'MAX_TOKENS') {
      throw new AiOutputError(
        'AI_OUTPUT_TRUNCATED',
        'Google LLM output was truncated before a complete structured response was produced.',
        {
          provider: 'google',
          model,
          finishReason,
          parseMode: 'raw',
          maxTokens: request.options?.maxTokens ?? this.config.maxTokens,
          temperature: request.options?.temperature ?? this.config.temperature,
        },
      );
    }

    const { data, parseMode, rawLength, jsonLength } = parseStructuredLlmOutput({
      rawText,
      schema,
      allowJsonExtraction: true,
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
