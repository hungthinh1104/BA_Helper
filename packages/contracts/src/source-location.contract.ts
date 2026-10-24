import { z } from 'zod';

export const sourceLocationSchema = z.object({
  relativePath: z.string().min(1).max(1000).refine(path =>
    !path.startsWith('/') && !path.includes('\\') &&
    path.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')),
  /** UTF-16 source offsets; endOffset is exclusive. */
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  startLine: z.number().int().positive(),
  startColumn: z.number().int().positive(),
  endLine: z.number().int().positive(),
  endColumn: z.number().int().positive(),
}).refine(location => location.endOffset > location.startOffset);
