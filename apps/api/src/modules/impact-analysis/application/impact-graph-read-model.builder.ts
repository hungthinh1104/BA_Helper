import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '../../../shared/app-error';
import {
  ImpactGraphResponse,
  ImpactGraphNode,
  ImpactGraphEdge,
  GraphNodeType,
  GraphEdgeType,
} from '@ba-helper/contracts';

@Injectable()
export class ImpactGraphReadModelBuilder {
  private readonly logger = new Logger(ImpactGraphReadModelBuilder.name);

  constructor(private readonly prisma: PrismaService) {}

  private mapGraphNodeType(artifact: { artifactType: string; universalKind?: string | null }): GraphNodeType {
    if (artifact.artifactType === 'CONTROLLER') return 'CONTROLLER';
    if (artifact.artifactType === 'API_ROUTE') return 'API_ROUTE';
    if (artifact.artifactType === 'SERVICE_METHOD') return 'SERVICE_METHOD';
    if (artifact.artifactType === 'ENTITY') return 'ENTITY';
    if (artifact.artifactType === 'TEST') return 'TEST';

    if (artifact.universalKind === 'API_ENDPOINT') return 'API_ROUTE';
    if (artifact.universalKind === 'DOMAIN_SERVICE') return 'SERVICE_METHOD';
    if (artifact.universalKind === 'DATA_MODEL') return 'ENTITY';
    if (artifact.universalKind === 'TEST_CASE') return 'TEST';

    return 'SERVICE';
  }

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
              include: { evidence: true }
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
    const sortedTraceabilityLinks = [...analysis.traceabilityLinks].sort((a, b) => {
      const scoreA = (a.retrievalMetadata as any)?.hybridScore || 0;
      const scoreB = (b.retrievalMetadata as any)?.hybridScore || 0;
      return scoreB - scoreA;
    });

    for (const link of sortedTraceabilityLinks) {
      if (nodes.length >= maxNodes) break;
      
      const artifact = link.artifact;
      const nodeId = `artifact-${artifact.id}`;
      affectedArtifactIds.add(artifact.id);

      const type = this.mapGraphNodeType(artifact);

      nodes.push({
        id: nodeId,
        type,
        label: artifact.name,
        filePath: artifact.filePath,
        artifactKey: artifact.artifactKey,
        reviewStatus: link.reviewStatus as any,
        retrieval: link.retrievalMetadata as any,
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
          confidence: link.confidence || undefined,
          sourceKind: 'TRACEABILITY',
        });
      }
    }

    // 3. Fetch Dependency Edges between affected artifacts
    if (affectedArtifactIds.size > 0 && edges.length < maxEdges) {
      const deps = await this.prisma.dependencyEdge.findMany({
        where: {
          snapshotId: analysis.snapshotId,
          fromArtifactId: { in: Array.from(affectedArtifactIds) },
          toArtifactId: { in: Array.from(affectedArtifactIds) },
        }
      });

      for (const dep of deps) {
        if (edges.length >= maxEdges) break;

        let edgeType: GraphEdgeType = 'CALLS';
        if (dep.type === 'CALLS') edgeType = 'CALLS';
        else if (dep.type === 'REFERENCES') edgeType = 'USES';
        else if (dep.type === 'TESTS') edgeType = 'TESTS';
        else if (dep.type === 'IMPORTS') edgeType = 'USES';

        // Swap TESTS edge direction for top-down layout readability.
        // Semantic meaning: Test → Service; Visual layout: Service → Test.
        // displayDirectionReversed=true signals this to API consumers.
        let sourceNode = `artifact-${dep.fromArtifactId}`;
        let targetNode = `artifact-${dep.toArtifactId}`;
        let displayDirectionReversed = false;
        if (edgeType === 'TESTS') {
          sourceNode = `artifact-${dep.toArtifactId}`;
          targetNode = `artifact-${dep.fromArtifactId}`;
          displayDirectionReversed = true;
        }

        edges.push({
          id: `edge-dep-${dep.id}`,
          source: sourceNode,
          target: targetNode,
          type: edgeType,
          sourceKind: 'DEPENDENCY',
          displayDirectionReversed: displayDirectionReversed || undefined,
        });
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

      let type: GraphNodeType = 'INSIGHT';
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
        if (evLink.evidence.artifactId && affectedArtifactIds.has(evLink.evidence.artifactId)) {
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
