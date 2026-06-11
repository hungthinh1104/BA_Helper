import { z } from 'zod';
import { AiOutputError } from '../domain/ai.errors';

export interface ParseStructuredLlmOutputParams<T> {
  rawText: string | null | undefined;
  schema: z.ZodSchema<T>;
  allowJsonExtraction?: boolean;
}

export interface ParseStructuredLlmOutputResult<T> {
  data: T;
  parseMode: 'raw' | 'extracted';
  rawLength: number;
  jsonLength: number;
}

export function parseStructuredLlmOutput<T>({
  rawText,
  schema,
  allowJsonExtraction = true,
}: ParseStructuredLlmOutputParams<T>): ParseStructuredLlmOutputResult<T> {
  if (!rawText || rawText.trim().length === 0) {
    throw new AiOutputError('AI_EMPTY_RESPONSE', 'LLM returned an empty response.');
  }

  const rawLength = rawText.length;
  let jsonString = rawText;
  let parseMode: 'raw' | 'extracted' = 'raw';
  let rawJsonObj: any;

  // 1. Try parsing raw
  try {
    rawJsonObj = JSON.parse(jsonString);
  } catch (e) {
    // 2. Fallback to extraction if allowed
    if (allowJsonExtraction) {
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
        jsonString = rawText.substring(firstBrace, lastBrace + 1);
        try {
          rawJsonObj = JSON.parse(jsonString);
          parseMode = 'extracted';
        } catch (e2) {
          throw new AiOutputError('AI_JSON_PARSE_FAILED', 'Failed to parse JSON even after extraction', { rawText, extractedText: jsonString });
        }
      } else {
        throw new AiOutputError('AI_JSON_PARSE_FAILED', 'Failed to parse JSON and could not extract JSON braces', { rawText });
      }
    } else {
      throw new AiOutputError('AI_JSON_PARSE_FAILED', 'Failed to parse JSON and extraction is disabled', { rawText });
    }
  }

  // 3. Zod Validate
  const jsonLength = jsonString.length;
  const parsed = schema.safeParse(rawJsonObj);

  if (!parsed.success) {
    throw new AiOutputError('AI_OUTPUT_SCHEMA_INVALID', 'AI output does not match expected schema', {
      errors: parsed.error.format(),
      rawJsonObj
    });
  }

  return {
    data: parsed.data,
    parseMode,
    rawLength,
    jsonLength,
  };
}
