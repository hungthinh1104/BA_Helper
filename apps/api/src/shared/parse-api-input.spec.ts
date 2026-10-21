import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { parseApiInput } from './parse-api-input';

describe('parseApiInput', () => {
  it('returns schema output with coercion, defaults and transforms applied', () => {
    const schema = z.object({
      label: z.string().trim().min(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });
    expect(parseApiInput(schema, { label: '  refunds  ', limit: '40' })).toEqual({ label: 'refunds', limit: 40 });
    expect(parseApiInput(schema, { label: 'refunds' })).toEqual({ label: 'refunds', limit: 20 });
  });

  it('returns a generic 400 without echoing rejected fields or secret values', () => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(12) });
    try {
      parseApiInput(schema, { email: 'not-an-email', password: 'secret-marker-from-input' });
      throw new Error('Expected invalid input to be rejected.');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse();
      expect(JSON.stringify(response)).toContain('Request input is invalid.');
      expect(JSON.stringify(response)).not.toContain('secret-marker-from-input');
    }
  });

  it('preserves cross-field refinements', () => {
    const schema = z.object({ start: z.number(), end: z.number() }).superRefine((value, context) => {
      if (value.end < value.start) context.addIssue({ code: z.ZodIssueCode.custom, message: 'end must follow start' });
    });
    expect(() => parseApiInput(schema, { start: 3, end: 2 })).toThrow(BadRequestException);
  });
});
