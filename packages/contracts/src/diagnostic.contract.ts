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

export const embeddingReusePlanPayloadSchema = z.object({
  baseSnapshotId: z.string().uuid().nullable(),
  targetSnapshotId: z.string().uuid(),
  reuseMode: z.literal('PLAN_ONLY'),
  reuseSafety: z.enum([
    'NO_BASELINE',
    'SAFE_FOR_FUTURE_REUSE',
    'VERSION_CHANGED_REVIEW_REQUIRED'
  ]),
  eligibleArtifactCount: z.number().int().nonnegative(),
  ineligibleArtifactCount: z.number().int().nonnegative(),
  eligibleRatio: z.number().min(0).max(1),
  ineligibleReasons: z.object({
    addedArtifactCount: z.number().int().nonnegative(),
    changedArtifactCount: z.number().int().nonnegative(),
    removedArtifactCount: z.number().int().nonnegative(),
    hashUnavailableArtifactCount: z.number().int().nonnegative(),
    versionChangedBlockedCount: z.number().int().nonnegative(),
  }),
  sampleLimit: z.literal(20),
  samples: z.object({
    eligible: z.array(artifactReuseSampleSchema),
    ineligible: z.array(artifactReuseSampleSchema),
  }),
});

export type ArtifactReuseSample = z.infer<typeof artifactReuseSampleSchema>;
export type IncrementalScanSummaryPayload = z.infer<typeof incrementalScanSummaryPayloadSchema>;
export type EmbeddingReusePlanPayload = z.infer<typeof embeddingReusePlanPayloadSchema>;

// ── Phase 31D: Execution Diagnostic ──────────────────────────────────────────

const reuseExecutionSampleSchema = z.object({
  artifactKey: z.string(),
  filePath: z.string(),
  chunkType: z.string(),
  reason: z.string().optional(),
});

export const embeddingReuseExecutionSummaryPayloadSchema = z.object({
  mode: z.literal('SNAPSHOT_SCOPED_COPY'),
  baseSnapshotId: z.string().uuid().nullable(),
  targetSnapshotId: z.string().uuid(),
  embeddingModel: z.string(),
  chunkerVersion: z.string(),
  copiedChunkCount: z.number().int().nonnegative(),
  generatedChunkCount: z.number().int().nonnegative(),
  ineligibleChunkCount: z.number().int().nonnegative(),
  missingPreviousChunkCount: z.number().int().nonnegative(),
  versionBlockedChunkCount: z.number().int().nonnegative(),
  modelMismatchChunkCount: z.number().int().nonnegative(),
  chunkHashMismatchCount: z.number().int().nonnegative(),
  legacyChunkerVersionBlockedCount: z.number().int().nonnegative(),
  sampleLimit: z.literal(20),
  samples: z.object({
    copied: z.array(reuseExecutionSampleSchema).max(20),
    generated: z.array(reuseExecutionSampleSchema).max(20),
    blocked: z.array(reuseExecutionSampleSchema).max(20),
  }),
});

export type ReuseExecutionSample = z.infer<typeof reuseExecutionSampleSchema>;
export type EmbeddingReuseExecutionSummaryPayload = z.infer<
  typeof embeddingReuseExecutionSummaryPayloadSchema
>;

// ── Phase 33A: Domain Pack Diagnostic ──────────────────────────────────────────

export const domainPackAppliedDiagnosticPayloadSchema = z.object({
  domainPackId: z.string(),
  domainPackVersion: z.string(),
  domainPackStatus: z.enum(['STABLE', 'PARTIAL', 'EXPERIMENTAL', 'FALLBACK']),
  selectedBy: z.enum(['EXPLICIT', 'REPOSITORY_PROFILE', 'FALLBACK']),
  conceptCount: z.number().int().nonnegative(),
  retrievalHintCount: z.number().int().nonnegative(),
  riskTemplateCount: z.number().int().nonnegative(),
  qaTemplateCount: z.number().int().nonnegative(),
  unknownTemplateCount: z.number().int().nonnegative(),
});

export type DomainPackAppliedDiagnosticPayload = z.infer<
  typeof domainPackAppliedDiagnosticPayloadSchema
>;

// ── Phase 37A: Scanner Capability Diagnostic ─────────────────────────────────────────

export const scannerCapabilitySummaryPayloadSchema = z.object({
  adapterId: z.string(),
  adapterVersion: z.string(),
  language: z.enum(['typescript', 'java', 'go', 'python', 'csharp', 'php', 'ruby']),
  framework: z.enum(['nestjs', 'spring_boot', 'gin', 'net/http', 'fastapi', 'aspnetcore', 'laravel', 'rails']).optional(),
  status: z.enum(['STABLE', 'PARTIAL', 'EXPERIMENTAL']),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  supportedArtifactKindCount: z.number().int().nonnegative(),
  supportedPatternCount: z.number().int().nonnegative(),
  partialPatternCount: z.number().int().nonnegative(),
  unsupportedPatternCount: z.number().int().nonnegative(),
});

export type ScannerCapabilitySummaryPayload = z.infer<
  typeof scannerCapabilitySummaryPayloadSchema
>;
