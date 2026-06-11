import { z } from 'zod';
import { retrievalMetadataSchema } from './retrieval.contract';

export const graphNodeTypeSchema = z.enum([
  'REQUIREMENT',
  'ANALYSIS',
  'CONTROLLER',
  'API_ROUTE',
  'SERVICE',
  'SERVICE_METHOD',
  'ENTITY',
  'TEST',
  'INSIGHT',
  'UNKNOWN',
  'QA_SCENARIO',
]);

export const graphEdgeTypeSchema = z.enum([
  'AFFECTS',
  'CALLS',
  'USES',
  'TESTS',
  'EVIDENCES',
  'RAISES_UNKNOWN',
  'SUGGESTS_QA',
]);

export const graphNodeSourceSchema = z.enum([
  'TRACEABILITY',
  'DEPENDENCY',
  'INSIGHT',
  'EVIDENCE',
  'ROOT',
]);

export const graphEdgeSourceKindSchema = z.enum([
  'TRACEABILITY',
  'DEPENDENCY',
  'EVIDENCE_LINK',
  'ROOT_LINK',
]);

export const impactGraphNodeSchema = z.object({
  id: z.string(),
  type: graphNodeTypeSchema,
  label: z.string(),
  subtitle: z.string().optional(),
  filePath: z.string().optional(),
  artifactKey: z.string().optional(),
  status: z.string().optional(),
  certainty: z.enum(['EVIDENCED', 'INFERRED', 'UNKNOWN']).optional(),
  reviewStatus: z.enum(['NEEDS_REVIEW', 'CONFIRMED', 'REJECTED']).optional(),
  retrieval: retrievalMetadataSchema.optional(),
  rank: z.number().optional(),
  isTruncated: z.boolean().optional(),
  source: graphNodeSourceSchema.optional(),
  // Specifically for Insights where evidence is shown in inspector instead of separate nodes
  evidenceSummary: z.string().optional(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
  commitSha: z.string().optional(),
  description: z.string().optional(),
  reasoning: z.string().optional(),
});

export const impactGraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: graphEdgeTypeSchema,
  label: z.string().optional(),
  confidence: z.number().optional(),
  sourceKind: graphEdgeSourceKindSchema.optional(),
  /** When true, source/target have been swapped from semantic direction for layout readability. */
  displayDirectionReversed: z.boolean().optional(),
});

export const impactGraphResponseSchema = z.object({
  analysisId: z.string(),
  snapshotId: z.string(),
  nodes: z.array(impactGraphNodeSchema),
  edges: z.array(impactGraphEdgeSchema),
});

export type GraphNodeType = z.infer<typeof graphNodeTypeSchema>;
export type GraphEdgeType = z.infer<typeof graphEdgeTypeSchema>;
export type ImpactGraphNode = z.infer<typeof impactGraphNodeSchema>;
export type ImpactGraphEdge = z.infer<typeof impactGraphEdgeSchema>;
export type ImpactGraphResponse = z.infer<typeof impactGraphResponseSchema>;
