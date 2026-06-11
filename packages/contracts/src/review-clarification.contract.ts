import { z } from 'zod';

export const reviewClarificationStatusSchema = z.enum(['OPEN', 'ANSWERED', 'CANCELLED']);

export const reviewClarificationRequestSchema = z.object({
  id: z.string().uuid(),
  analysisId: z.string().uuid(),
  reviewDecisionId: z.string().uuid(),
  question: z.string().min(1),
  answer: z.string().nullable(),
  status: reviewClarificationStatusSchema,
  createdBy: z.string(),
  answeredBy: z.string().nullable(),
  createdAt: z.string().datetime(),
  answeredAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  derivedAnalyses: z.array(z.object({ id: z.string().uuid() })).optional(),
});

export type ReviewClarificationRequest = z.infer<typeof reviewClarificationRequestSchema>;

export const reviewClarificationCreateRequestSchema = z.object({
  reviewDecisionId: z.string().uuid(),
  question: z.string().min(1).max(4000),
});

export type ReviewClarificationCreateRequest = z.infer<typeof reviewClarificationCreateRequestSchema>;

export const reviewClarificationAnswerRequestSchema = z.object({
  answer: z.string().min(1).max(8000),
});

export type ReviewClarificationAnswerRequest = z.infer<typeof reviewClarificationAnswerRequestSchema>;

export const reviewClarificationListResponseSchema = z.object({
  items: z.array(reviewClarificationRequestSchema),
});

export type ReviewClarificationListResponse = z.infer<typeof reviewClarificationListResponseSchema>;
