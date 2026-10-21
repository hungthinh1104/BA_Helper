import { z } from 'zod';

const sourceLocationSchema = z.object({
  sourcePath: z.string().min(1).refine(path =>
    !/^(?:[a-z]:|[/\\])/i.test(path) && !path.split(/[/\\]/).includes('..'),
  'Source paths must be repository-relative.'),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
}).refine(location => location.endLine >= location.startLine, 'Invalid source line range.');

/** Source relationships are static observations, not execution/coverage results. */
export const dependencyEdgeProvenanceSchema = z.object({
  kind: z.literal('STATIC_SOURCE_REFERENCE'),
  resolver: z.enum(['TS_AST_DIRECT_CALL', 'TS_AST_ENTITY_REFERENCE']),
  evidenceProvenanceKey: z.string().min(1),
  locations: z.array(sourceLocationSchema).min(1).max(20),
  omittedLocationCount: z.number().int().nonnegative().optional(),
});

export const dependencyConfidenceSchema = z.number().min(0).max(1);
export type DependencyEdgeProvenance = z.infer<typeof dependencyEdgeProvenanceSchema>;
