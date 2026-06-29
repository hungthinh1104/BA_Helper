import type { z } from 'zod';
import { AiOutputError } from '@ba-helper/application';

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

const MARKDOWN_JSON_FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

function stripMarkdownJsonFence(rawText: string): string {
  const fenced = rawText.trim().match(MARKDOWN_JSON_FENCE);
  return fenced ? fenced[1].trim() : rawText;
}

function findMatchingClosingIndex(
  input: string,
  startIndex: number,
  opening: '{' | '[',
  closing: '}' | ']',
): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractTopLevelJson(rawText: string): string | null {
  const normalized = stripMarkdownJsonFence(rawText).trim();
  const objectIndex = normalized.indexOf('{');
  const arrayIndex = normalized.indexOf('[');

  if (objectIndex === -1 && arrayIndex === -1) {
    return null;
  }

  const startIndex =
    objectIndex === -1
      ? arrayIndex
      : arrayIndex === -1
        ? objectIndex
        : Math.min(objectIndex, arrayIndex);
  const opening = normalized[startIndex] as '{' | '[';
  const closing = opening === '{' ? '}' : ']';
  const endIndex = findMatchingClosingIndex(normalized, startIndex, opening, closing);

  if (endIndex === -1) {
    return null;
  }

  return normalized.slice(startIndex, endIndex + 1).trim();
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
  const normalizedRaw = stripMarkdownJsonFence(rawText).trim();
  let jsonString = normalizedRaw;
  let parseMode: 'raw' | 'extracted' = 'raw';
  let rawJsonObj: unknown;

  try {
    rawJsonObj = JSON.parse(jsonString);
  } catch {
    if (!allowJsonExtraction) {
      throw new AiOutputError('AI_JSON_PARSE_FAILED', 'Failed to parse JSON and extraction is disabled.', {
        rawText,
      });
    }

    const extractedJson = extractTopLevelJson(rawText);
    if (!extractedJson) {
      throw new AiOutputError('AI_JSON_PARSE_FAILED', 'Failed to parse JSON and could not extract a complete top-level JSON payload.', {
        rawText,
      });
    }

    jsonString = extractedJson;
    try {
      rawJsonObj = JSON.parse(jsonString);
      parseMode = 'extracted';
    } catch {
      throw new AiOutputError('AI_JSON_PARSE_FAILED', 'Failed to parse extracted JSON payload.', {
        rawText,
        extractedText: jsonString,
      });
    }
  }

  const jsonLength = jsonString.length;
  const parsed = schema.safeParse(rawJsonObj);

  if (!parsed.success) {
    throw new AiOutputError(
      'AI_OUTPUT_SCHEMA_VALIDATION_FAILED',
      'AI output does not match expected schema.',
      {
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
        rawJsonObj,
      },
    );
  }

  return {
    data: parsed.data,
    parseMode,
    rawLength,
    jsonLength,
  };
}
