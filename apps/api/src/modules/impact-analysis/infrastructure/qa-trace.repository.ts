import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ba-helper/backend-runtime';
import type { Prisma } from '@prisma/client';
import type { QaTraceLimitation } from '@ba-helper/contracts';
import { QA_TRACE_LIMITS } from '../domain/qa-trace.types';
import type { QaTraceArtifact, QaTraceEdge, QaTraceInput } from '../domain/qa-trace.types';
import { isQaTraceCode } from '../domain/qa-trace.policy';

const artifactSelect = {
  id: true, snapshotId: true, artifactKey: true, name: true, artifactType: true,
  universalKind: true, filePath: true, startLine: true, endLine: true, metadata: true,
} as const;

@Injectable()
export class QaTraceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEvidence(snapshotId: string, evidenceId: string) {
    return this.prisma.evidence.findFirst({ where: { id: evidenceId, snapshotId }, select: {
      id: true, snapshotId: true, artifactId: true, provenanceKey: true, sourceType: true,
      sourcePath: true, startLine: true, endLine: true, excerpt: true,
    } });
  }

  async read(analysisId: string): Promise<QaTraceInput | null> {
    return this.prisma.$transaction(async tx => {
      const analysis = await tx.impactAnalysis.findUnique({ where: { id: analysisId }, select: {
        id: true, snapshotId: true, snapshot: { select: {
          id: true, commitSha: true, analyzerVersion: true, coverageStatus: true, diagnostics: true,
        } },
      } });
      if (!analysis) return null;
      const impacted = await tx.codeArtifact.findMany({ where: {
        // Read all linked artifact identities; foreign snapshots are reported as exclusions, not silently omitted.
        traceabilityLinks: { some: { impactAnalysisId: analysisId } },
      }, select: artifactSelect, orderBy: [{ artifactKey: 'asc' }, { id: 'asc' }],
      take: QA_TRACE_LIMITS.maxImpactedArtifacts + 1 });
      const limitations: QaTraceLimitation[] = impacted.length > QA_TRACE_LIMITS.maxImpactedArtifacts
        ? ['IMPACTED_ARTIFACT_LIMIT'] : [];
      const selected = impacted.slice(0, QA_TRACE_LIMITS.maxImpactedArtifacts);
      const sameSnapshot = selected.filter(artifact => artifact.snapshotId === analysis.snapshotId);
      const upstream = await this.readUpstream(tx, analysis.snapshotId, sameSnapshot, limitations);
      const sourceKeys = [...new Set(upstream.edges.map(edge => upstream.artifacts.get(edge.fromArtifactId))
        .filter((a): a is QaTraceArtifact => Boolean(a))
        .map(a => `snapshot:${analysis.snapshotId}:artifact:${a.artifactKey}`))].sort();
      const evidences = sourceKeys.length ? await tx.evidence.findMany({ where: {
        snapshotId: analysis.snapshotId, provenanceKey: { in: sourceKeys },
      }, select: { id: true, snapshotId: true, artifactId: true, provenanceKey: true,
        sourceType: true, sourcePath: true, startLine: true, endLine: true, excerpt: true } }) : [];
      return { analysisId: analysis.id, snapshot: analysis.snapshot,
        impactedArtifactIds: selected.map(a => a.id), artifacts: [...upstream.artifacts.values(),
          ...selected.filter(artifact => artifact.snapshotId !== analysis.snapshotId)],
        edges: upstream.edges, evidences, limitations };
    }, { isolationLevel: 'RepeatableRead' });
  }

  private async readUpstream(tx: Prisma.TransactionClient, snapshotId: string,
    impacted: QaTraceArtifact[], limitations: QaTraceLimitation[]) {
    const artifacts = new Map(impacted.map(a => [a.id, a]));
    const edges: QaTraceEdge[] = [];
    let frontier = impacted.filter(isQaTraceCode).map(a => a.id);
    const visited = new Set(frontier);
    for (let depth = 0; depth <= QA_TRACE_LIMITS.maxCallDepth && frontier.length; depth++) {
      const remaining = QA_TRACE_LIMITS.maxEdges - edges.length;
      const incoming = await tx.dependencyEdge.findMany({ where: {
        snapshotId, fromArtifact: { snapshotId }, toArtifact: { snapshotId },
        toArtifactId: { in: frontier }, type: { in: ['TESTS', 'CALLS'] },
      }, include: { fromArtifact: { select: artifactSelect }, toArtifact: { select: artifactSelect } },
      orderBy: [{ type: 'asc' }, { fromArtifactId: 'asc' }, { toArtifactId: 'asc' }, { id: 'asc' }], take: remaining + 1 });
      const next = new Set<string>();
      for (const { fromArtifact, toArtifact, ...edge } of incoming.slice(0, remaining)) {
        edges.push(edge);
        artifacts.set(fromArtifact.id, fromArtifact);
        artifacts.set(toArtifact.id, toArtifact);
        if (edge.type !== 'CALLS' || !isQaTraceCode(fromArtifact) || visited.has(fromArtifact.id)) continue;
        if (depth === QA_TRACE_LIMITS.maxCallDepth) limitations.push('CALL_DEPTH_LIMIT');
        else { visited.add(fromArtifact.id); next.add(fromArtifact.id); }
      }
      if (incoming.length > remaining) { limitations.push('EDGE_LIMIT'); break; }
      frontier = [...next].sort();
    }
    return { artifacts, edges };
  }
}
