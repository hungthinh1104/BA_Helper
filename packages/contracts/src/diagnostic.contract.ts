import { z } from 'zod';

export const diagnosticSeveritySchema = z.enum(['INFO', 'WARN', 'ERROR', 'BLOCKER']);

export const diagnosticCategorySchema = z.enum([
  'SECURITY',
  'LIMIT',
  'FRAMEWORK',
  'FILE_SYSTEM',
  'GIT',
  'SCANNER',
]);

export const diagnosticItemSchema = z.object({
  code: z.string(),
  severity: diagnosticSeveritySchema,
  message: z.string(),
  category: diagnosticCategorySchema.optional(),
  count: z.number().int().min(1).optional(),
  samplePaths: z.array(z.string()).max(5).optional(),
  payload: z.record(z.unknown()).optional(),
});

export type DiagnosticSeverity = z.infer<typeof diagnosticSeveritySchema>;
export type DiagnosticCategory = z.infer<typeof diagnosticCategorySchema>;
export type DiagnosticItem = z.infer<typeof diagnosticItemSchema>;

export const artifactReuseSampleSchema = z.object({
  artifactKey: z.string(),
  universalKind: z.string(),
  artifactType: z.string(),
  filePath: z.string(),
  symbolName: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
});

export const incrementalScanSummaryPayloadSchema = z.object({
  baseSnapshotId: z.string().uuid().nullable(),
  addedArtifactCount: z.number().int().nonnegative(),
  changedArtifactCount: z.number().int().nonnegative(),
  unchangedArtifactCount: z.number().int().nonnegative(),
  removedArtifactCount: z.number().int().nonnegative(),
  hashUnavailableArtifactCount: z.number().int().nonnegative(),
  reuseEligibleArtifactCount: z.number().int().nonnegative(),
  reuseEligibleRatio: z.number().min(0).max(1),
  reuseSafety: z.enum([
    'NO_BASELINE',
    'SAFE_FOR_FUTURE_REUSE',
    'VERSION_CHANGED_REVIEW_REQUIRED'
  ]),
  warnings: z.array(z.string()),
  sampleLimit: z.literal(20),
  samples: z.object({
    added: z.array(artifactReuseSampleSchema),
    changed: z.array(artifactReuseSampleSchema),
    removed: z.array(artifactReuseSampleSchema),
    hashUnavailable: z.array(artifactReuseSampleSchema),
  }),
});

export type ArtifactReuseSample = z.infer<typeof artifactReuseSampleSchema>;
export type IncrementalScanSummaryPayload = z.infer<typeof incrementalScanSummaryPayloadSchema>;
