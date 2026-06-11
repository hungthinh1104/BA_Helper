import { z } from 'zod';

const smokeExpectedOutcomeSchema = z.object({
  allowCoverageStatuses: z.array(z.enum(['READY', 'PARTIAL'])).min(1),
  maxAnalysisDurationMs: z.number().int().positive(),
  maxScanDurationMs: z.number().int().positive(),
  minInsights: z.number().int().positive(),
  requireApprovedReport: z.literal(true),
  requireNoBlockerSecurityDiagnostics: z.literal(true),
});

const smokeManifestSchema = z.object({
  changeRequestRawText: z.string().min(1),
  changeRequestTitle: z.string().min(1),
  expected: smokeExpectedOutcomeSchema,
  name: z.string().min(1),
  repositoryUrl: z.string().url(),
  requestedRef: z.string().min(1),
});

export type PublicGitHubSmokeManifest = z.infer<typeof smokeManifestSchema>;

export const publicGitHubSmokeManifest: PublicGitHubSmokeManifest =
  smokeManifestSchema.parse({
    name: 'public-booking-demo',
    repositoryUrl: 'https://github.com/ndmen/booking',
    requestedRef: 'main',
    changeRequestTitle: 'Paid booking cancellation refund',
    changeRequestRawText:
      'Allow users to cancel paid bookings and receive refund.',
    expected: {
      allowCoverageStatuses: ['READY', 'PARTIAL'],
      maxAnalysisDurationMs: 180_000,
      maxScanDurationMs: 180_000,
      minInsights: 1,
      requireApprovedReport: true,
      requireNoBlockerSecurityDiagnostics: true,
    },
  });

export const publicGitHubSmokeManifestSchema = smokeManifestSchema;

