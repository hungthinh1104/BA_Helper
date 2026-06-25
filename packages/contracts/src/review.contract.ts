import { z } from 'zod';

export const reportLocaleSchema = z.enum(['en', 'vi']);

export const localeAwareReportQuerySchema = z.object({
  locale: reportLocaleSchema.default('en'),
});

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
export type ReportLocale = z.infer<typeof reportLocaleSchema>;
export type LocaleAwareReportQuery = z.infer<typeof localeAwareReportQuerySchema>;

export const finalReviewedReportResponseSchema = z.object({
  analysisId: z.string().min(1),
  snapshotId: z.string().min(1),
  locale: reportLocaleSchema.default('en'),
  markdown: z.string().nullable().optional(),
  createdAt: z.string(),
  reviewCompletion: reviewCompletionResponseSchema,
  reviewDecisionsSnapshot: z.unknown(),
  evidenceQualitySummarySnapshot: z.unknown(),
  evaluationContextSnapshot: z.unknown().nullable(),
  createdByUserId: z.string().min(1).nullable().optional(),
});

export type FinalReviewedReportResponse = z.infer<typeof finalReviewedReportResponseSchema>;
