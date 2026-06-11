import { z } from 'zod';

export const ClarificationStatusSchema = z.enum(['OPEN', 'ANSWERED', 'DISMISSED', 'CONVERTED_TO_REVISION']);

export const ClarificationItemDtoSchema = z.object({
  id: z.string().uuid(),
  impactAnalysisId: z.string().uuid(),
  sourceInsightId: z.string().uuid(),
  question: z.string(),
  reason: z.string().nullable(),
  status: ClarificationStatusSchema,
  answer: z.string().nullable(),
  convertedRequirementRevisionId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ClarificationItemDto = z.infer<typeof ClarificationItemDtoSchema>;

export const CreateClarificationRequestSchema = z.object({
  sourceInsightId: z.string().uuid(),
});

export type CreateClarificationRequest = z.infer<typeof CreateClarificationRequestSchema>;

export const AnswerClarificationRequestSchema = z.object({
  answer: z.string().min(1).max(4000),
});

export type AnswerClarificationRequest = z.infer<typeof AnswerClarificationRequestSchema>;

export const DismissClarificationRequestSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export type DismissClarificationRequest = z.infer<typeof DismissClarificationRequestSchema>;

export const ClarificationListResponseSchema = z.object({
  items: z.array(ClarificationItemDtoSchema),
});

export type ClarificationListResponse = z.infer<typeof ClarificationListResponseSchema>;

export const ConvertClarificationResponseSchema = z.object({
  clarificationId: z.string().uuid(),
  revisionId: z.string().uuid(),
  requirementId: z.string().uuid(),
  status: ClarificationStatusSchema,
});

export type ConvertClarificationResponse = z.infer<typeof ConvertClarificationResponseSchema>;
