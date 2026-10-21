import { z } from 'zod';
import { graphNodeTypeSchema } from './impact-graph.contract';
import { dependencyConfidenceSchema, dependencyEdgeProvenanceSchema } from './dependency-provenance.contract';

export const qaTraceLimitationSchema = z.enum([
  'SNAPSHOT_PARTIAL', 'LEGACY_TEST_IDENTITIES', 'SCANNER_LIMITATIONS',
  'IMPACTED_ARTIFACT_LIMIT', 'EDGE_LIMIT', 'CALL_DEPTH_LIMIT', 'TRACE_SAMPLE_LIMIT',
  'UNSUPPORTED_SOURCE_RELATIONSHIP',
]);

export const qaTraceArtifactSchema = z.object({
  id: z.string(), artifactKey: z.string(), label: z.string(),
  artifactType: graphNodeTypeSchema, filePath: z.string(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
});

export const qaTraceEdgeSchema = z.object({
  edgeId: z.string(), sourceArtifactId: z.string(), targetArtifactId: z.string(),
  type: z.enum(['TESTS', 'CALLS']), evidenceId: z.string(),
  confidence: dependencyConfidenceSchema.optional(),
  provenance: dependencyEdgeProvenanceSchema,
});

/** A source relationship path; never a record of test execution. */
export const qaTestTraceSchema = z.object({
  relation: z.enum(['DIRECT_REFERENCE', 'CALL_PATH']),
  artifacts: z.array(qaTraceArtifactSchema).min(2).max(6),
  edges: z.array(qaTraceEdgeSchema).min(1).max(5),
}).superRefine((trace, ctx) => {
  const invalid = trace.artifacts.length !== trace.edges.length + 1 ||
    trace.artifacts[0]?.artifactType !== 'TEST' ||
    new Set(trace.artifacts.map(artifact => artifact.id)).size !== trace.artifacts.length ||
    trace.artifacts.slice(1).some(artifact => !['CONTROLLER', 'API_ROUTE', 'SERVICE', 'SERVICE_METHOD', 'ENTITY'].includes(artifact.artifactType)) ||
    (trace.relation === 'DIRECT_REFERENCE' ? trace.edges.length !== 1 : trace.edges.length < 2) ||
    trace.edges.some((edge, index) => edge.type !== (index === 0 ? 'TESTS' : 'CALLS') ||
      edge.sourceArtifactId !== trace.artifacts[index]?.id ||
      edge.targetArtifactId !== trace.artifacts[index + 1]?.id);
  if (invalid) ctx.addIssue({ code: 'custom', message: 'Trace must be a connected test-to-code source path.' });
});

export const qaTraceContextSchema = z.object({
  basis: z.literal('STATIC_SOURCE_REFERENCE'),
  commitSha: z.string(), analyzerVersion: z.string(),
  snapshotCoverageStatus: z.enum(['READY', 'PARTIAL']),
  limitations: z.array(qaTraceLimitationSchema),
  limits: z.object({
    maxCallDepth: z.number().int().nonnegative().max(4),
    maxImpactedArtifacts: z.number().int().positive(),
    maxEdges: z.number().int().positive(),
    maxTracesPerArtifact: z.number().int().positive(),
  }),
});

export type QaTraceLimitation = z.infer<typeof qaTraceLimitationSchema>;
export type QaTraceArtifact = z.infer<typeof qaTraceArtifactSchema>;
export type QaTraceEdge = z.infer<typeof qaTraceEdgeSchema>;
export type QaTestTrace = z.infer<typeof qaTestTraceSchema>;
