import { z } from 'zod';

export const diagnosticSeveritySchema = z.enum(['INFO', 'WARN', 'ERROR', 'BLOCKER']);

export const diagnosticCategorySchema = z.enum([
  'SECURITY',
  'LIMIT',
  'FRAMEWORK',
  'FILE_SYSTEM',
  'GIT',
  'SCANNER',
]);

export const diagnosticItemSchema = z.object({
  code: z.string(),
  severity: diagnosticSeveritySchema,
  message: z.string(),
  category: diagnosticCategorySchema.optional(),
  count: z.number().int().min(1).optional(),
  samplePaths: z.array(z.string()).max(5).optional(),
  payload: z.record(z.unknown()).optional(),
});

export type DiagnosticSeverity = z.infer<typeof diagnosticSeveritySchema>;
export type DiagnosticCategory = z.infer<typeof diagnosticCategorySchema>;
export type DiagnosticItem = z.infer<typeof diagnosticItemSchema>;
