import { dependencyConfidenceSchema, dependencyEdgeProvenanceSchema } from '@ba-helper/contracts';
import type { ArtifactRecord, EdgeRecord, EvidenceRecord } from './get-code-comprehension.mapper';

/** Analyzer USES edges persist as REFERENCES; show them only with matching entity and source evidence. */
export function validateStaticEntityUse(edge: EdgeRecord, snapshotId: string,
  artifacts: Map<string, ArtifactRecord>, evidences: Map<string, EvidenceRecord>): boolean {
  if (edge.type !== 'REFERENCES' || edge.snapshotId !== snapshotId) return false;
  const from = artifacts.get(edge.fromArtifactId), to = artifacts.get(edge.toArtifactId);
  if (!from || !to || from.snapshotId !== snapshotId || to.snapshotId !== snapshotId ||
    !['SERVICE_METHOD', 'API_ROUTE'].includes(from.artifactType) || to.artifactType !== 'ENTITY') return false;
  const parsed = dependencyEdgeProvenanceSchema.safeParse(edge.metadata);
  if (!parsed.success || parsed.data.resolver !== 'TS_AST_ENTITY_REFERENCE' ||
    parsed.data.evidenceProvenanceKey !== `snapshot:${snapshotId}:artifact:${from.artifactKey}`) return false;
  const evidence = evidences.get(parsed.data.evidenceProvenanceKey);
  if (!evidence || evidence.snapshotId !== snapshotId || evidence.artifactId !== from.id ||
    evidence.sourceType !== 'CODE' || evidence.sourcePath !== from.filePath || !evidence.excerpt.trim()) return false;
  if (edge.confidence !== null && !dependencyConfidenceSchema.safeParse(edge.confidence).success) return false;
  return parsed.data.locations.every(location => location.sourcePath === from.filePath &&
    from.startLine !== null && from.endLine !== null && evidence.startLine !== null && evidence.endLine !== null &&
    location.startLine >= Math.max(from.startLine, evidence.startLine) &&
    location.endLine <= Math.min(from.endLine, evidence.endLine));
}
