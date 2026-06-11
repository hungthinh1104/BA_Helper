import { z } from 'zod';

export const lineageTimelineEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    'REQUIREMENT_CREATED',
    'REQUIREMENT_REVISED',
    'ANALYSIS_CREATED',
    'ANALYSIS_COMPLETED',
    'REVIEW_DECISION',
    'CLARIFICATION_REQUESTED',
    'CLARIFICATION_ANSWERED',
    'DERIVED_ANALYSIS_CREATED',
    'IMPACT_DIFF_AVAILABLE',
  ]),
  title: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.string().datetime(),
  actor: z.string().optional(),

  analysisId: z.string().uuid().optional(),
  requirementRevisionId: z.string().uuid().optional(),
  reviewDecisionId: z.string().uuid().optional(),
  clarificationRequestId: z.string().uuid().optional(),
  relatedAnalysisId: z.string().uuid().optional(),

  metadata: z.record(z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string()),
  ])).optional(),
});

export const lineageTimelineResponseSchema = z.object({
  rootAnalysisId: z.string().uuid(),
  currentAnalysisId: z.string().uuid(),
  depth: z.number().int().nonnegative(),
  events: z.array(lineageTimelineEventSchema),
});

export type LineageTimelineEvent = z.infer<typeof lineageTimelineEventSchema>;
export type LineageTimelineResponse = z.infer<typeof lineageTimelineResponseSchema>;
