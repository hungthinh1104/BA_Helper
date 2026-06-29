import { z } from 'zod';
import { parseStructuredLlmOutput } from './structured-output';
import { AiOutputError } from '../domain/ai.errors';

describe('Structured Output Parser', () => {
  const schema = z.object({
    success: z.boolean(),
    message: z.string(),
  });

  it('parses valid raw JSON directly', () => {
    const rawText = JSON.stringify({ success: true, message: 'OK' });
    const result = parseStructuredLlmOutput({ rawText, schema, allowJsonExtraction: true });
    
    expect(result.data).toEqual({ success: true, message: 'OK' });
    expect(result.parseMode).toBe('raw');
    expect(result.rawLength).toBe(rawText.length);
    expect(result.jsonLength).toBe(rawText.length);
  });

  it('extracts valid JSON if wrapped in text', () => {
    const jsonText = JSON.stringify({ success: true, message: 'Extracted' });
    const rawText = `<think>some reasoning</think>\nHere is the output:\n${jsonText}\nDone.`;
    
    const result = parseStructuredLlmOutput({ rawText, schema, allowJsonExtraction: true });
    
    expect(result.data).toEqual({ success: true, message: 'Extracted' });
    expect(result.parseMode).toBe('extracted');
    expect(result.rawLength).toBe(rawText.length);
    expect(result.jsonLength).toBe(jsonText.length);
  });

  it('extracts fenced JSON payloads', () => {
    const rawText = '```json\n{"success":true,"message":"Fenced"}\n```';
    const result = parseStructuredLlmOutput({ rawText, schema, allowJsonExtraction: true });

    expect(result.data).toEqual({ success: true, message: 'Fenced' });
    expect(result.parseMode).toBe('raw');
  });

  it('throws AI_EMPTY_RESPONSE for empty string', () => {
    expect(() => parseStructuredLlmOutput({ rawText: '   ', schema }))
      .toThrow(AiOutputError);
    
    try {
      parseStructuredLlmOutput({ rawText: '', schema });
    } catch (e: any) {
      expect(e.code).toBe('AI_EMPTY_RESPONSE');
    }
  });

  it('throws AI_JSON_PARSE_FAILED for invalid JSON', () => {
    const rawText = `{"success": true, "message": "unclosed string}`;
    try {
      parseStructuredLlmOutput({ rawText, schema, allowJsonExtraction: true });
      fail('Expected to throw');
    } catch (e: any) {
      expect(e.code).toBe('AI_JSON_PARSE_FAILED');
    }
  });

  it('throws AI_JSON_PARSE_FAILED if wrapped JSON is invalid and extraction disabled', () => {
    const jsonText = JSON.stringify({ success: true, message: 'Extracted' });
    const rawText = `Some text ${jsonText}`;
    
    try {
      parseStructuredLlmOutput({ rawText, schema, allowJsonExtraction: false });
      fail('Expected to throw');
    } catch (e: any) {
      expect(e.code).toBe('AI_JSON_PARSE_FAILED');
    }
  });

  it('throws AI_OUTPUT_SCHEMA_VALIDATION_FAILED if JSON is valid but does not match schema', () => {
    const rawText = JSON.stringify({ unknownField: 'test' });
    try {
      parseStructuredLlmOutput({ rawText, schema, allowJsonExtraction: true });
      fail('Expected to throw');
    } catch (e: any) {
      expect(e.code).toBe('AI_OUTPUT_SCHEMA_VALIDATION_FAILED');
      expect(e.details?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'success',
          }),
        ]),
      );
    }
  });
});
