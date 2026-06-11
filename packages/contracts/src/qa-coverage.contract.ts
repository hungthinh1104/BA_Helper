import { z } from 'zod';
import { graphNodeTypeSchema } from './impact-graph.contract';

export const qaCoverageStatusSchema = z.enum(["COVERED", "INDIRECT_ONLY", "NO_TEST_FOUND"]);
export const qaCoverageSeveritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const qaCoverageItemSchema = z.object({
  artifactId: z.string(),
  artifactKey: z.string().optional(),
  artifactLabel: z.string(),
  artifactType: graphNodeTypeSchema,
  filePath: z.string().optional(),

  status: qaCoverageStatusSchema,
  severity: qaCoverageSeveritySchema,

  testArtifacts: z.array(z.object({
    id: z.string(),
    label: z.string(),
    filePath: z.string().optional(),
  })),

  reason: z.string(),
  suggestedAction: z.string(),
  confidenceNote: z.string().optional(),
});

export const qaCoverageResponseSchema = z.object({
  analysisId: z.string(),
  snapshotId: z.string(),
  summary: z.object({
    covered: z.number(),
    indirectOnly: z.number(),
    noTestFound: z.number(),
    highSeverityGaps: z.number(),
  }),
  items: z.array(qaCoverageItemSchema),
});

export type QaCoverageStatus = z.infer<typeof qaCoverageStatusSchema>;
export type QaCoverageSeverity = z.infer<typeof qaCoverageSeveritySchema>;
export type QaCoverageItem = z.infer<typeof qaCoverageItemSchema>;
export type QaCoverageResponse = z.infer<typeof qaCoverageResponseSchema>;
