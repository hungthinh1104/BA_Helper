import { z } from 'zod';
import { qaCoverageResponseSchema } from './qa-coverage.contract';
import { qaTraceContextSchema } from './qa-test-trace.contract';
import { evidenceSchema } from './evidence.contract';

export const reportTestTraceSnapshotSchema = z.object({
  version: z.literal(1),
  coverage: qaCoverageResponseSchema.extend({ traceContext: qaTraceContextSchema }),
}).superRefine(({ coverage }, ctx) => {
  for (const item of coverage.items) for (const test of item.testArtifacts) {
    const trace = test.trace;
    if (!test.testCase || !trace || trace.artifacts[0].id !== test.id ||
      trace.artifacts[trace.artifacts.length - 1]?.id !== item.artifactId || trace.edges.some((edge, index) =>
        edge.provenance.evidenceProvenanceKey !== `snapshot:${coverage.snapshotId}:artifact:${trace.artifacts[index].artifactKey}`)) {
      ctx.addIssue({ code: 'custom', message: 'Saved test paths must preserve their artifact and snapshot evidence origins.' });
    }
  }
});

export const testTraceEvidenceResponseSchema = z.object({
  analysisId: z.string(), snapshotId: z.string(), commitSha: z.string(), evidence: evidenceSchema,
});

export type ReportTestTraceSnapshot = z.infer<typeof reportTestTraceSnapshotSchema>;
export type TestTraceEvidenceResponse = z.infer<typeof testTraceEvidenceResponseSchema>;
