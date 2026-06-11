import { z } from 'zod';

export const reviewQueueItemTypeSchema = z.enum([
  'INSIGHT',
  'TRACEABILITY_LINK',
  'QA_COVERAGE_GAP',
  'UNKNOWN',
  'QA_SCENARIO'
]);

export const reviewQueueItemPrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const reviewQueueItemSourceSchema = z.enum([
  'INSIGHT',
  'TRACEABILITY',
  'QA_COVERAGE',
  'RETRIEVAL'
]);

export const reviewQueueItemReviewStatusSchema = z.enum([
  'NEEDS_REVIEW',
  'CONFIRMED',
  'REJECTED'
]);

export const reviewQueueItemSchema = z.object({
  id: z.string(),
  type: reviewQueueItemTypeSchema,
  priority: reviewQueueItemPrioritySchema,
  title: z.string(),
  reason: z.string(),

  rank: z.number(),
  priorityReason: z.string(),

  linkedInsightId: z.string().optional(),
  linkedTraceabilityLinkId: z.string().optional(),
  linkedArtifactId: z.string().optional(),
  evidenceIds: z.array(z.string()).optional(),

  suggestedAction: z.string().optional(),
  qaFocus: z.string().optional(),
  baQuestion: z.string().optional(),
  risk: z.string().optional(),

  reviewStatus: reviewQueueItemReviewStatusSchema.optional(),
  requiresDecision: z.boolean(),
  blockingFinalize: z.boolean(),

  source: reviewQueueItemSourceSchema,
});

export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;

export const reviewQueueSummarySchema = z.object({
  total: z.number(),
  remaining: z.number(),
  blockingRemaining: z.number(),
  highRiskRemaining: z.number(),
});

export type ReviewQueueSummary = z.infer<typeof reviewQueueSummarySchema>;

export const reviewQueueResponseSchema = z.object({
  analysisId: z.string(),
  summary: reviewQueueSummarySchema,
  items: z.array(reviewQueueItemSchema),
});

export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
