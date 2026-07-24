import { z } from 'zod';
import { reportReviewCoverageSummarySchema } from './document.contract';
import { supportedAppLocales } from './locale.contract';

export const reportLocaleSchema = z.enum(supportedAppLocales);

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
    'CONFLICTING_EVIDENCE_UNREVIEWED',
    'CRITICAL_MISSING_EVIDENCE',
    'REVIEW_REQUIRED_ITEMS',
    'HIGH_RISK_INSIGHT_UNREVIEWED',
    'INFERRED_LINKS_UNREVIEWED',
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
  reviewCoverageSummary: reportReviewCoverageSummarySchema.nullable().optional(),
  reviewDecisionsSnapshot: z.unknown(),
  evidenceQualitySummarySnapshot: z.unknown(),
  evaluationContextSnapshot: z.unknown().nullable(),
  createdByUserId: z.string().min(1).nullable().optional(),
});

export type FinalReviewedReportResponse = z.infer<typeof finalReviewedReportResponseSchema>;
