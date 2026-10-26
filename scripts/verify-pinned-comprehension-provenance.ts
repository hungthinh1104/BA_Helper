import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { dependencyEdgeProvenanceSchema } from '../packages/contracts/src/dependency-provenance.contract';
import type { PrismaService } from '../packages/backend-runtime/src/index';

type EvidenceView = {
  id: string | null; sourceType: string; artifactId: string | null; provenanceKey: string | null;
  filePath: string; startLine: number | null; endLine: number | null; excerpt: string; commitSha: string;
};
type ProjectionView = {
  selectedCode: { id: string; filePath: string };
  codeEvidence: { source: EvidenceView; staticCalls: Array<{
    edgeId: string; type: string; sourceArtifactId: string; targetArtifactId: string;
    provenance?: unknown; evidence?: EvidenceView;
  }> };
  relatedScenarios: Array<{ trace?: { relationships: Array<{
    edgeId: string; type: string; sourceArtifactId: string; targetArtifactId: string;
    provenance?: unknown; evidence?: EvidenceView;
  }> } }>;
};
type PersistedArtifact = { id: string; snapshotId: string; filePath: string; startLine: number | null; endLine: number | null };
type PersistedEvidence = {
  id: string; snapshotId: string | null; artifactId: string | null; provenanceKey: string;
  sourceType: string; sourcePath: string | null; startLine: number | null; endLine: number | null;
  excerpt: string; isRedacted: boolean;
};
type PersistedEdge = {
  id: string; snapshotId: string; fromArtifactId: string; toArtifactId: string; type: string; metadata: unknown;
};
type VerificationInput = {
  root: string; snapshotId: string; commitSha: string; projections: ProjectionView[];
  artifacts: PersistedArtifact[]; evidences: PersistedEvidence[]; edges: PersistedEdge[];
};

export async function verifyPersistedPinnedProjections(prisma: PrismaService, root: string,
  snapshotId: string, commitSha: string, projections: ProjectionView[]) {
  const relationships = projections.flatMap(projection => [
    ...projection.codeEvidence.staticCalls,
    ...projection.relatedScenarios.flatMap(scenario => scenario.trace?.relationships ?? []),
  ]);
  const evidenceKeys = new Set(projections.map(projection => projection.codeEvidence.source.provenanceKey)
    .filter((key): key is string => Boolean(key)));
  const edgeIds = new Set<string>();
  const artifactIds = new Set(projections.map(projection => projection.selectedCode.id));
  for (const relationship of relationships) {
    edgeIds.add(relationship.edgeId);
    artifactIds.add(relationship.sourceArtifactId);
    artifactIds.add(relationship.targetArtifactId);
    if (relationship.evidence?.provenanceKey) evidenceKeys.add(relationship.evidence.provenanceKey);
  }
  const [artifacts, evidences, edges] = await Promise.all([
    prisma.codeArtifact.findMany({ where: { snapshotId, id: { in: [...artifactIds] } },
      select: { id: true, snapshotId: true, filePath: true, startLine: true, endLine: true } }),
    prisma.evidence.findMany({ where: { snapshotId, provenanceKey: { in: [...evidenceKeys] } },
      select: { id: true, snapshotId: true, artifactId: true, provenanceKey: true, sourceType: true,
        sourcePath: true, startLine: true, endLine: true, excerpt: true, isRedacted: true } }),
    prisma.dependencyEdge.findMany({ where: { snapshotId, id: { in: [...edgeIds] } },
      select: { id: true, snapshotId: true, fromArtifactId: true, toArtifactId: true, type: true, metadata: true } }),
  ]);
  return verifyPinnedProjectionProvenance({ root, snapshotId, commitSha, projections, artifacts, evidences, edges });
}

export function verifyPinnedProjectionProvenance(input: VerificationInput) {
  const artifactById = new Map(input.artifacts.map(item => [item.id, item]));
  const evidenceByKey = new Map(input.evidences.map(item => [item.provenanceKey, item]));
  const edgeById = new Map(input.edges.map(item => [item.id, item]));
  const checkedFiles = new Map<string, string[]>();
  const sourceEvidenceIds = new Set<string>();
  const relationshipIds = new Set<string>();

  for (const projection of input.projections) {
    const selectedArtifact = artifactById.get(projection.selectedCode.id);
    if (!selectedArtifact || selectedArtifact.snapshotId !== input.snapshotId ||
      selectedArtifact.filePath !== projection.selectedCode.filePath) {
      throw new Error('Selected source artifact does not match the pinned snapshot.');
    }
    const source = projection.codeEvidence.source;
    verifyEvidence(source, selectedArtifact.id, 'CODE', input, evidenceByKey, artifactById, checkedFiles);
    if (source.commitSha !== input.commitSha) throw new Error('Source evidence belongs to a different commit.');
    if (source.id) sourceEvidenceIds.add(source.id);

    const relationships = [
      ...projection.codeEvidence.staticCalls,
      ...projection.relatedScenarios.flatMap(scenario => scenario.trace?.relationships ?? []),
    ];
    for (const relationship of relationships) {
      const edge = edgeById.get(relationship.edgeId);
      if (!edge || edge.snapshotId !== input.snapshotId || edge.fromArtifactId !== relationship.sourceArtifactId ||
        edge.toArtifactId !== relationship.targetArtifactId || edge.type !== relationship.type) {
        throw new Error('Displayed relationship does not match its persisted snapshot edge.');
      }
      const provenance = dependencyEdgeProvenanceSchema.safeParse(relationship.provenance);
      const persistedProvenance = dependencyEdgeProvenanceSchema.safeParse(edge.metadata);
      if (!provenance.success || !persistedProvenance.success ||
        provenance.data.evidenceProvenanceKey !== persistedProvenance.data.evidenceProvenanceKey ||
        JSON.stringify(provenance.data.locations) !== JSON.stringify(persistedProvenance.data.locations)) {
        throw new Error('Displayed relationship provenance does not match its persisted edge.');
      }
      if (!relationship.evidence || provenance.data.evidenceProvenanceKey !== relationship.evidence.provenanceKey) {
        throw new Error('Displayed relationship evidence provenance key does not match its source evidence.');
      }
      const sourceArtifact = artifactById.get(edge.fromArtifactId);
      const targetArtifact = artifactById.get(edge.toArtifactId);
      const expectedSourceType = edge.type === 'TESTS' ? 'TEST' : edge.type === 'CALLS' ? 'CODE' : undefined;
      if (!sourceArtifact || !targetArtifact || targetArtifact.snapshotId !== input.snapshotId ||
        !expectedSourceType || !relationship.evidence) {
        throw new Error('Displayed relationship has no supported source artifact or evidence.');
      }
      verifyEvidence(relationship.evidence, sourceArtifact.id, expectedSourceType,
        input, evidenceByKey, artifactById, checkedFiles);
      if (relationship.evidence.commitSha !== input.commitSha) {
        throw new Error('Relationship evidence belongs to a different commit.');
      }
      for (const location of provenance.data.locations) {
        if (location.sourcePath !== sourceArtifact.filePath ||
          location.startLine < (relationship.evidence.startLine ?? 1) ||
          location.endLine > (relationship.evidence.endLine ?? 0)) {
          throw new Error('Edge provenance location is outside its persisted source evidence.');
        }
      }
      relationshipIds.add(edge.id);
    }
  }

  return { sourceEvidenceCount: sourceEvidenceIds.size, relationshipCount: relationshipIds.size,
    sourceFileCount: checkedFiles.size };
}

function verifyEvidence(view: EvidenceView, artifactId: string, sourceType: string, input: VerificationInput,
  evidenceByKey: Map<string, PersistedEvidence>, artifactById: Map<string, PersistedArtifact>,
  checkedFiles: Map<string, string[]>): void {
  if (!view.id || !view.provenanceKey || view.artifactId !== artifactId || view.sourceType !== sourceType ||
    !view.excerpt.trim() || view.commitSha !== input.commitSha) {
    throw new Error('Displayed evidence is incomplete or belongs to the wrong artifact.');
  }
  const canonicalRelativePath = view.filePath.replace(/\\/g, '/');
  if (!canonicalRelativePath || canonicalRelativePath.startsWith('/') ||
    /^[A-Za-z]:/.test(canonicalRelativePath) || canonicalRelativePath.split('/').includes('..') ||
    canonicalRelativePath.split('/').includes('.') || canonicalRelativePath.includes('//')) {
    throw new Error('Evidence path must be canonical and repository-relative.');
  }
  const record = evidenceByKey.get(view.provenanceKey);
  if (!record || record.id !== view.id || record.snapshotId !== input.snapshotId ||
    record.artifactId !== artifactId || record.sourceType !== sourceType || record.sourcePath !== view.filePath ||
    record.startLine !== view.startLine || record.endLine !== view.endLine || record.excerpt !== view.excerpt ||
    record.isRedacted) {
    throw new Error('Displayed evidence does not match its persisted snapshot provenance record.');
  }
  const artifact = artifactById.get(artifactId);
  if (!artifact || artifact.snapshotId !== input.snapshotId || artifact.filePath !== view.filePath ||
    view.startLine === null || view.endLine === null || artifact.startLine === null || artifact.endLine === null ||
    view.startLine < artifact.startLine || view.endLine > artifact.endLine) {
    throw new Error('Evidence location does not match its source artifact.');
  }
  const root = path.resolve(input.root);
  const absolutePath = path.resolve(root, canonicalRelativePath);
  const relativePath = path.relative(root, absolutePath);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath) || !existsSync(absolutePath)) {
    throw new Error('Evidence path is outside the checkout or missing from the pinned repository.');
  }
  let sourceLines = checkedFiles.get(canonicalRelativePath);
  if (!sourceLines) {
    sourceLines = readFileSync(absolutePath, 'utf8').split(/\r\n?|\n/);
    checkedFiles.set(canonicalRelativePath, sourceLines);
  }
  if (view.startLine < 1 || view.endLine < view.startLine || view.endLine > sourceLines.length) {
    throw new Error('Evidence line range does not exist in the pinned source file.');
  }
  const sourceRange = sourceLines.slice(view.startLine - 1, view.endLine).join('\n');
  const excerpt = view.excerpt.replace(/\r\n?/g, '\n');
  if (!excerpt || !sourceRange.includes(excerpt)) {
    throw new Error('Evidence excerpt does not match source text at its pinned location.');
  }
}
