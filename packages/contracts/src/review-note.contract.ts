import { z } from 'zod';

export const reviewNoteSchema = z.object({
  id: z.string().uuid(),
  impactAnalysisId: z.string().uuid(),
  insightId: z.string().uuid().optional().nullable(),
  traceabilityLinkId: z.string().uuid().optional().nullable(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ReviewNoteResponse = z.infer<typeof reviewNoteSchema>;

export const createReviewNoteRequestSchema = z
  .object({
    insightId: z.string().uuid().optional().nullable(),
    traceabilityLinkId: z.string().uuid().optional().nullable(),
    body: z.string().trim().min(1).max(2000),
  })
  .superRefine((val, ctx) => {
    const hasInsight = Boolean(val.insightId);
    const hasLink = Boolean(val.traceabilityLinkId);

    if (hasInsight === hasLink) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide exactly one of insightId or traceabilityLinkId.',
        path: ['insightId'],
      });
    }
  });

export type CreateReviewNoteRequest = z.infer<typeof createReviewNoteRequestSchema>;

export const updateReviewNoteRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export type UpdateReviewNoteRequest = z.infer<typeof updateReviewNoteRequestSchema>;
