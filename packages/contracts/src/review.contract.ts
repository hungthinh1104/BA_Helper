import { z } from 'zod';

export const reviewCompletionResponseSchema = z.object({
  analysisId: z.string().min(1),
  totalLinks: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  needsMoreEvidence: z.number().int().nonnegative(),
  unreviewed: z.number().int().nonnegative(),
  isComplete: z.boolean(),
  hasReviewedSnapshot: z.boolean(),
  latestSnapshotId: z.string().min(1).nullable().optional(),
  blockingReasons: z.array(z.enum([
    'UNREVIEWED_TRACEABILITY_LINKS',
    'REVIEWED_SNAPSHOT_MISSING',
  ])),
});

export type ReviewCompletionResponse = z.infer<typeof reviewCompletionResponseSchema>;
