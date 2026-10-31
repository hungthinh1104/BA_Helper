import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import {
  ImpactGraphResponse,
  ImpactGraphNode,
  ImpactGraphEdge,
  GraphEdgeType,
  retrievalMetadataSchema,
} from '@ba-helper/contracts';
import { isEvidenceScopedToAnalysis, PrismaService } from "@ba-helper/backend-runtime";
import { mapDependencyGraphEdge } from './impact-dependency-graph.mapper';
import { mapArtifactGraphNodeType } from './impact-artifact-graph.mapper';
import { readTestCaseMetadata } from '../../../artifact/application/artifact-response.mapper';

@Injectable()
export class ImpactGraphReadModelBuilder {
  private readonly logger = new Logger(ImpactGraphReadModelBuilder.name);

  constructor(private readonly prisma: PrismaService) {}

  async buildGraph(analysisId: string): Promise<ImpactGraphResponse> {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        snapshot: true,
        requirementRevision: {
          include: { requirement: true }
        },
        traceabilityLinks: {
          include: { artifact: true }
        },
        insights: {
          include: {
            evidenceLinks: {
              include: { evidence: { include: { artifact: { select: { snapshotId: true } } } } }
            }
          }
        }
      }
    });

    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', `ImpactAnalysis ${analysisId} not found`);
    }

    const nodes: ImpactGraphNode[] = [];
    const edges: ImpactGraphEdge[] = [];
    const maxNodes = 50;
    const maxEdges = 80;

    // 1. Root Nodes
    const reqRevision = analysis.requirementRevision;
    const reqNodeId = `req-${reqRevision.id}`;
    
    nodes.push({
      id: reqNodeId,
      type: 'REQUIREMENT',
      label: reqRevision.title,
      source: 'ROOT',
      rank: 0,
    });

    nodes.push({
      id: `analysis-${analysis.id}`,
      type: 'ANALYSIS',
      label: 'Impact Analysis',
      subtitle: analysis.status,
      source: 'ROOT',
      rank: 1,
    });

    edges.push({
      id: `edge-root-${analysis.id}`,
      source: reqNodeId,
      target: `analysis-${analysis.id}`,
      type: 'AFFECTS',
      sourceKind: 'ROOT_LINK',
    });

    // 2. Map Traceability Links (Artifacts)
    const affectedArtifactIds = new Set<string>();
    
    // Sort traceability links by retrieval score for truncation priority
    const sortedTraceabilityLinks = analysis.traceabilityLinks
      .filter((link) => link.artifact.snapshotId === analysis.snapshotId)
      .sort((a, b) => {
      const scoreA = (a.retrievalMetadata as any)?.hybridScore || 0;
      const scoreB = (b.retrievalMetadata as any)?.hybridScore || 0;
      return scoreB - scoreA;
      });

    for (const link of sortedTraceabilityLinks) {
      if (nodes.length >= maxNodes) break;
      
      const artifact = link.artifact;
      const nodeId = `artifact-${artifact.id}`;
      affectedArtifactIds.add(artifact.id);

      const type = mapArtifactGraphNodeType(artifact);
      const retrieval = retrievalMetadataSchema.safeParse(link.retrievalMetadata);

      nodes.push({
        id: nodeId,
        type,
        label: artifact.name,
        filePath: artifact.filePath,
        artifactKey: artifact.artifactKey,
        testCase: readTestCaseMetadata(artifact),
        reviewStatus: link.reviewStatus as any,
        retrieval: retrieval.success ? retrieval.data : undefined,
        commitSha: analysis.snapshot.commitSha,
        source: 'TRACEABILITY',
        rank: 2,
      });

      if (edges.length < maxEdges) {
        edges.push({
          id: `edge-trace-${link.id}`,
          source: `analysis-${analysis.id}`,
          target: nodeId,
          type: 'AFFECTS',
          confidence: link.confidence ?? undefined,
          sourceKind: 'TRACEABILITY',
        });
      }
    }

    // 3. Fetch Dependency Edges (1-hop neighbors of affected artifacts)
    if (affectedArtifactIds.size > 0 && edges.length < maxEdges) {
      const deps = await this.prisma.dependencyEdge.findMany({
        where: {
          snapshotId: analysis.snapshotId,
          fromArtifact: { snapshotId: analysis.snapshotId },
          toArtifact: { snapshotId: analysis.snapshotId },
          OR: [
            { fromArtifactId: { in: Array.from(affectedArtifactIds) } },
            { toArtifactId: { in: Array.from(affectedArtifactIds) } },
          ],
        },
        include: {
          fromArtifact: true,
          toArtifact: true,
        }
      });

      for (const dep of deps) {
        if (edges.length >= maxEdges) break;

        // Ensure 1-hop neighbor nodes are added to the graph
        if (!affectedArtifactIds.has(dep.fromArtifactId) && nodes.length < maxNodes) {
          affectedArtifactIds.add(dep.fromArtifactId);
          nodes.push({
            id: `artifact-${dep.fromArtifactId}`,
            type: mapArtifactGraphNodeType(dep.fromArtifact),
            label: dep.fromArtifact.name,
            filePath: dep.fromArtifact.filePath,
            artifactKey: dep.fromArtifact.artifactKey,
            testCase: readTestCaseMetadata(dep.fromArtifact),
            commitSha: analysis.snapshot.commitSha,
            source: 'DEPENDENCY',
            rank: 4,
          });
        }
        if (!affectedArtifactIds.has(dep.toArtifactId) && nodes.length < maxNodes) {
          affectedArtifactIds.add(dep.toArtifactId);
          nodes.push({
            id: `artifact-${dep.toArtifactId}`,
            type: mapArtifactGraphNodeType(dep.toArtifact),
            label: dep.toArtifact.name,
            filePath: dep.toArtifact.filePath,
            artifactKey: dep.toArtifact.artifactKey,
            testCase: readTestCaseMetadata(dep.toArtifact),
            commitSha: analysis.snapshot.commitSha,
            source: 'DEPENDENCY',
            rank: 4,
          });
        }

        const edge = mapDependencyGraphEdge(dep);
        if (edge) edges.push(edge);
      }
    }

    // 4. Map Insights and Unknowns/QA
    // Prioritize CONFIRMED > NEEDS_REVIEW > REJECTED
    const sortedInsights = [...analysis.insights].sort((a, b) => {
      const rankA = a.reviewStatus === 'CONFIRMED' ? 0 : a.reviewStatus === 'NEEDS_REVIEW' ? 1 : 2;
      const rankB = b.reviewStatus === 'CONFIRMED' ? 0 : b.reviewStatus === 'NEEDS_REVIEW' ? 1 : 2;
      return rankA - rankB;
    });

    for (const insight of sortedInsights) {
      if (nodes.length >= maxNodes) break;

      let type: ImpactGraphNode['type'] = 'INSIGHT';
      let edgeType: GraphEdgeType = 'EVIDENCES';
      
      if (insight.insightType === 'UNKNOWN') {
        type = 'UNKNOWN';
        edgeType = 'RAISES_UNKNOWN';
      } else if (insight.insightType === 'QA_SCENARIO') {
        type = 'QA_SCENARIO';
        edgeType = 'SUGGESTS_QA';
      }

      const insightNodeId = `insight-${insight.id}`;
      
      let mappedArtifactId: string | null = null;
      let evidenceSummary = '';
      let startLine: number | undefined;
      let endLine: number | undefined;

      for (const evLink of insight.evidenceLinks) {
        if (isEvidenceScopedToAnalysis(evLink.evidence, analysis) &&
          evLink.evidence.artifactId && affectedArtifactIds.has(evLink.evidence.artifactId)) {
          mappedArtifactId = evLink.evidence.artifactId;
          evidenceSummary = evLink.evidence.excerpt.substring(0, 200) + (evLink.evidence.excerpt.length > 200 ? '...' : '');
          if (evLink.evidence.startLine !== null) startLine = evLink.evidence.startLine;
          if (evLink.evidence.endLine !== null) endLine = evLink.evidence.endLine;
          break;
        }
      }

      nodes.push({
        id: insightNodeId,
        type,
        label: insight.title,
        subtitle: insight.insightType,
        certainty: insight.certainty as any,
        reviewStatus: insight.reviewStatus as any,
        evidenceSummary: evidenceSummary,
        startLine: startLine,
        endLine: endLine,
        description: insight.description,
        reasoning: insight.reasoning || undefined,
        source: 'INSIGHT',
        rank: 3,
      });

      if (edges.length < maxEdges) {
        const targetNodeId = mappedArtifactId ? `artifact-${mappedArtifactId}` : `analysis-${analysis.id}`;
        
        edges.push({
          id: `edge-insight-${insight.id}`,
          source: targetNodeId,
          target: insightNodeId,
          type: edgeType,
          sourceKind: 'EVIDENCE_LINK',
        });
      }
    }

    let isTruncated = false;
    if (analysis.traceabilityLinks.length + analysis.insights.length + 2 > maxNodes) {
        isTruncated = true;
    }

    return {
      analysisId: analysis.id,
      snapshotId: analysis.snapshotId,
      nodes: nodes.map(n => ({...n, isTruncated})),
      edges,
    };
  }
}
