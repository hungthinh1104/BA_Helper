import {
  codeArtifactMetadataSchema,
  comprehensionEvidenceSchema,
  dependencyEdgeProvenanceSchema,
  type ComprehensionEvidence,
  type CodeEvidenceMetadata,
} from '@ba-helper/contracts';
import type { DependencyEdgeType } from '@prisma/client';
import type { ArtifactRepository, EvidenceRepository, GraphRepository } from '@ba-helper/backend-runtime';

export type ArtifactRecord = Awaited<ReturnType<ArtifactRepository['listBySnapshotAndIds']>>[number];
export type EdgeRecord = Awaited<ReturnType<GraphRepository['listIncomingBySnapshotAndTargets']>>[number];
export type EvidenceRecord = Awaited<ReturnType<EvidenceRepository['listByArtifactIds']>>[number];
export type Diagnostic = { code: string; message: string; severity: 'INFO' | 'WARN' };

export function mapArtifact(artifact: ArtifactRecord) {
  return { id: artifact.id, artifactKey: artifact.artifactKey, name: artifact.name, artifactType: artifact.artifactType,
    universalKind: artifact.universalKind ?? 'UNKNOWN', filePath: artifact.filePath, startLine: artifact.startLine, endLine: artifact.endLine };
}

export function readTestCase(artifact: ArtifactRecord) {
  const parsed = codeArtifactMetadataSchema.safeParse(artifact.metadata);
  return parsed.success ? parsed.data.testCase : undefined;
}

export function readCodeEvidence(artifact: ArtifactRecord) {
  const parsed = codeArtifactMetadataSchema.safeParse(artifact.metadata);
  return parsed.success ? parsed.data.codeEvidence : undefined;
}

export function mapCodeEvidence(metadata: CodeEvidenceMetadata, artifact: ArtifactRecord,
  source: ComprehensionEvidence, commitSha: string, limitations: Diagnostic[]) {
  const map = (excerpt: string, location: { relativePath: string; startLine: number; endLine: number }) => {
    const parsed = comprehensionEvidenceSchema.safeParse({
      id: null, evidenceKind: 'PRODUCTION_SOURCE', sourceType: 'CODE', artifactId: artifact.id,
      provenanceKey: source.provenanceKey, filePath: location.relativePath,
      startLine: location.startLine, endLine: location.endLine, excerpt, commitSha,
    });
    if (!parsed.success) {
      limitations.push(limitation('CODE_EVIDENCE_INVALID',
        'A persisted code declaration could not be represented with a canonical source location.', 'WARN'));
      return undefined;
    }
    return parsed.data;
  };
  return {
    parameters: metadata.parameters.map(item => map(item.sourceText, item.sourceLocation)).filter(
      (item): item is ComprehensionEvidence => item !== undefined),
    returnType: metadata.returnType ? map(metadata.returnType.text, metadata.returnType.sourceLocation) ?? null : null,
    conditions: metadata.conditions.map(item => map(item.sourceText, item.sourceLocation)).filter(
      (item): item is ComprehensionEvidence => item !== undefined),
    exceptionHandlers: metadata.exceptionHandlers.map(item => map(item.sourceText, item.sourceLocation)).filter(
      (item): item is ComprehensionEvidence => item !== undefined),
  };
}

export function mapEdgeEvidence(record: EvidenceRecord, evidenceKind: 'STATIC_TEST_DECLARATION' | 'STATIC_EDGE',
  commitSha: string, limitations: Diagnostic[]): ComprehensionEvidence | undefined {
  if (!record.sourcePath || !['CODE', 'TEST', 'STATIC_ANALYSIS'].includes(record.sourceType)) {
    limitations.push(limitation('EDGE_EVIDENCE_INVALID',
      'A graph edge provenance record is present but its source location is incomplete.', 'WARN'));
    return undefined;
  }
  const parsed = comprehensionEvidenceSchema.safeParse({ id: record.id, evidenceKind, sourceType: record.sourceType,
    artifactId: record.artifactId, provenanceKey: record.provenanceKey, filePath: record.sourcePath,
    startLine: record.startLine, endLine: record.endLine, excerpt: record.excerpt, commitSha });
  if (!parsed.success) {
    limitations.push(limitation('EDGE_EVIDENCE_INVALID',
      'A graph edge provenance record could not be represented by the comprehension contract.', 'WARN'));
    return undefined;
  }
  return parsed.data;
}

export function safeProvenance(value: object) {
  const result = dependencyEdgeProvenanceSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function findCallPath(start: string, target: string, outgoing: Map<string, EdgeRecord[]>, maxDepth: number,
  visited = new Set<string>([start])): EdgeRecord[] | undefined {
  if (start === target) return [];
  if (maxDepth <= 0) return undefined;
  for (const edge of outgoing.get(start) ?? []) {
    if (visited.has(edge.toArtifactId)) continue;
    const nextVisited = new Set(visited);
    nextVisited.add(edge.toArtifactId);
    const tail = findCallPath(edge.toArtifactId, target, outgoing, maxDepth - 1, nextVisited);
    if (tail) return [edge, ...tail];
  }
  return undefined;
}

export function limitation(code: string, message: string, severity: 'INFO' | 'WARN' = 'INFO'): Diagnostic {
  return { code, message, severity };
}

export function readSnapshotLimitations(value: unknown): Diagnostic[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === 'object' &&
    typeof (item as { code?: unknown }).code === 'string')
    .slice(0, 20).map(item => {
      const diagnostic = item as { code: string; message?: unknown; severity?: unknown };
      return limitation(diagnostic.code, typeof diagnostic.message === 'string' ? diagnostic.message : 'Snapshot diagnostic.',
        diagnostic.severity === 'WARN' || diagnostic.severity === 'ERROR' || diagnostic.severity === 'BLOCKER' ? 'WARN' : 'INFO');
    });
}

export function dedupeDiagnostics(items: Diagnostic[]): Diagnostic[] {
  return [...new Map(items.map(item => [`${item.code}:${item.message}`, item])).values()].slice(0, 50);
}
