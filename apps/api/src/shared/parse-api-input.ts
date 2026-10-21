import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

export function parseApiInput<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.output<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException('Request input is invalid.');
  return parsed.data;
}
