import { z } from 'zod';
import { sourceLocationSchema } from './source-location.contract';

export const codeEvidenceParameterSchema = z.object({
  name: z.string().min(1).max(200),
  typeText: z.string().min(1).max(2000),
  sourceText: z.string().min(1).max(2000),
  sourceLocation: sourceLocationSchema,
});

export const codeEvidenceDeclarationSchema = z.object({
  text: z.string().min(1).max(2000),
  sourceLocation: sourceLocationSchema,
});

export const codeEvidenceConditionSchema = z.object({
  kind: z.enum(['IF', 'SWITCH_CASE', 'SWITCH_DEFAULT']),
  sourceText: z.string().min(1).max(4000),
  sourceLocation: sourceLocationSchema,
});

export const codeEvidenceExceptionSchema = z.object({
  kind: z.enum(['CATCH', 'THROW']),
  sourceText: z.string().min(1).max(4000),
  sourceLocation: sourceLocationSchema,
});

export const codeEvidenceMetadataSchema = z.object({
  parameters: z.array(codeEvidenceParameterSchema).max(20),
  returnType: codeEvidenceDeclarationSchema.optional(),
  conditions: z.array(codeEvidenceConditionSchema).max(20),
  exceptionHandlers: z.array(codeEvidenceExceptionSchema).max(20),
});

export type CodeEvidenceMetadata = z.infer<typeof codeEvidenceMetadataSchema>;
