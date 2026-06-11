import { z } from 'zod';

export const driftStatusSchema = z.enum([
  'NO_DRIFT',
  'DRIFTED',
  'INCOMPATIBLE',
  'UNKNOWN',
]);

export const driftArtifactSampleSchema = z.object({
  artifactId: z.string().uuid(),
  artifactKey: z.string(),
  universalKind: z.string().nullable().optional(),
  artifactType: z.string().nullable().optional(),
  filePath: z.string().nullable().optional(),
  symbolName: z.string().nullable().optional(),
  displayName: z.string(),
});

export const driftChangedArtifactSampleSchema = driftArtifactSampleSchema.extend({
  baseArtifactId: z.string().uuid(),
  targetArtifactId: z.string().uuid(),
  baseContentHash: z.string(),
  targetContentHash: z.string(),
});

export const repositorySnapshotDriftResponseSchema = z.object({
  projectId: z.string().uuid(),
  repositoryId: z.string().uuid(),
  baseSnapshotId: z.string().uuid(),
  targetSnapshotId: z.string().uuid(),

  status: driftStatusSchema,

  summary: z.object({
    baseArtifactCount: z.number().int().min(0),
    targetArtifactCount: z.number().int().min(0),
    addedArtifactCount: z.number().int().min(0),
    removedArtifactCount: z.number().int().min(0),
    changedArtifactCount: z.number().int().min(0),
    unchangedArtifactCount: z.number().int().min(0),
    unknownChangedArtifactCount: z.number().int().min(0),
    hashUnavailableArtifactCount: z.number().int().min(0),
  }),

  versionComparison: z.object({
    baseScannerVersion: z.string().nullable().optional(),
    targetScannerVersion: z.string().nullable().optional(),
    baseAnalyzerVersion: z.string().nullable().optional(),
    targetAnalyzerVersion: z.string().nullable().optional(),
    scannerVersionChanged: z.boolean(),
    analyzerVersionChanged: z.boolean(),
  }),

  coverageComparison: z.object({
    baseCoverageStatus: z.string().nullable().optional(),
    targetCoverageStatus: z.string().nullable().optional(),
    coverageStatusChanged: z.boolean(),
  }),

  samples: z.object({
    addedArtifacts: z.array(driftArtifactSampleSchema),
    removedArtifacts: z.array(driftArtifactSampleSchema),
    changedArtifacts: z.array(driftChangedArtifactSampleSchema),
    unknownChangedArtifacts: z.array(driftArtifactSampleSchema),
  }),

  warnings: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
    })
  ),
});

export type DriftStatus = z.infer<typeof driftStatusSchema>;
export type DriftArtifactSample = z.infer<typeof driftArtifactSampleSchema>;
export type DriftChangedArtifactSample = z.infer<typeof driftChangedArtifactSampleSchema>;
export type RepositorySnapshotDriftResponse = z.infer<typeof repositorySnapshotDriftResponseSchema>;
