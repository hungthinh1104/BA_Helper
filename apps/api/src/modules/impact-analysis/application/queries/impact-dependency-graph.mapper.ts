import { dependencyEdgeProvenanceSchema } from '@ba-helper/contracts';
import type { GraphEdgeType, ImpactGraphEdge } from '@ba-helper/contracts';

type DependencyGraphRecord = {
  id: string;
  fromArtifactId: string;
  toArtifactId: string;
  type: string;
  confidence?: number | null;
  metadata?: unknown;
};

const edgeTypes: Record<string, GraphEdgeType> = {
  CALLS: 'CALLS', REFERENCES: 'REFERENCES', TESTS: 'TESTS', IMPORTS: 'IMPORTS',
};

export function mapDependencyGraphEdge(record: DependencyGraphRecord): ImpactGraphEdge | null {
  const type = edgeTypes[record.type];
  if (!type) return null;
  const reversed = type === 'TESTS';
  const provenance = dependencyEdgeProvenanceSchema.safeParse(record.metadata);
  return {
    id: `edge-dep-${record.id}`,
    source: `artifact-${reversed ? record.toArtifactId : record.fromArtifactId}`,
    target: `artifact-${reversed ? record.fromArtifactId : record.toArtifactId}`,
    type,
    sourceKind: 'DEPENDENCY',
    confidence: record.confidence ?? undefined,
    provenance: provenance.success ? provenance.data : undefined,
    // Layout changes direction; provenance continues to identify the semantic source.
    displayDirectionReversed: reversed || undefined,
  };
}
