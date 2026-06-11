import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type ReportDependencyEdge = {
  id: string;
  snapshotId: string;
  fromArtifactId: string;
  toArtifactId: string;
  type: string;
};

type TraceabilityLinkWithArtifact = Prisma.TraceabilityLinkGetPayload<{
  include: {
    artifact: true;
  };
}>;

type InsightWithEvidence = Prisma.BaInsightGetPayload<{
  include: {
    evidenceLinks: {
      include: {
        evidence: true;
      };
    };
  };
}>;

type RequirementRevision = Prisma.RequirementRevisionGetPayload<{}>;

@Injectable()
export class MermaidImpactDiagramBuilder {
  private getArtifactTypeLabel(artifact: { artifactType: string; universalKind?: string | null }): string {
    const type = artifact.artifactType;

    if (artifact.universalKind === 'API_ENDPOINT') return 'API';
    if (artifact.universalKind === 'DOMAIN_SERVICE') return 'Service';
    if (artifact.universalKind === 'DATA_MODEL') return 'Entity';
    if (artifact.universalKind === 'TEST_CASE') return 'Test';

    if (type.includes('CONTROLLER') || type.includes('ROUTE')) return 'API';
    if (type.includes('SERVICE')) return 'Service';
    if (type.includes('ENTITY') || type.includes('MODEL')) return 'Entity';
    if (type.includes('TEST')) return 'Test';
    return 'Component';
  }

  build(params: {
    requirement: RequirementRevision;
    traceabilityLinks: TraceabilityLinkWithArtifact[];
    dependencyEdges: ReportDependencyEdge[];
    insights: InsightWithEvidence[];
  }): { mermaid: string; isTruncated: boolean } {
    const { requirement, traceabilityLinks, dependencyEdges, insights } = params;

    // 1. Filter out rejected links and insights
    const approvedLinks = traceabilityLinks.filter((l) => l.reviewStatus !== 'REJECTED');
    const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');

    // 2. Identify all valid artifact IDs that are confirmed/needs_review (impacted)
    const impactedArtifactIds = new Set(
      approvedLinks.filter((l) => !!l.artifact).map((l) => l.artifact!.id),
    );

    // 3. Define Mermaid Nodes
    const nodes: { id: string; label: string; type: string; isArtifact: boolean; priority: number }[] = [];

    // Requirement Node
    nodes.push({
      id: 'n_req',
      label: `[Requirement] ${this.escapeLabel(requirement.title)}`,
      type: 'REQUIREMENT',
      isArtifact: false,
      priority: 1,
    });

    // Artifact Nodes
    for (const link of approvedLinks) {
      if (!link.artifact) continue;
      
      const type = link.artifact.artifactType;
      const typeLabel = this.getArtifactTypeLabel(link.artifact);

      // Priority: API > Service Method > Service Class > Entity > Test
      let priority = 5;
      if (typeLabel === 'API') priority = 2;
      else if (type.includes('METHOD')) priority = 3;
      else if (typeLabel === 'Service') priority = 3.5;
      else if (typeLabel === 'Entity') priority = 4;

      nodes.push({
        id: this.generateNodeId(link.artifact.id),
        label: `[${typeLabel}] ${this.escapeLabel(link.artifact.name)}`,
        type: link.artifact.artifactType,
        isArtifact: true,
        priority,
      });
    }

    // QA / Unknown Nodes (Optional, only if high priority)
    const qaAndUnknown = approvedInsights.filter((i) => i.insightType === 'QA_SCENARIO' || i.insightType === 'UNKNOWN');
    for (const insight of qaAndUnknown) {
      nodes.push({
        id: this.generateNodeId(insight.id),
        label: `[${insight.insightType === 'QA_SCENARIO' ? 'QA' : 'Unknown'}] ${this.escapeLabel(insight.title)}`,
        type: insight.insightType,
        isArtifact: false,
        priority: 6,
      });
    }

    // 4. Sort nodes by priority and cap at 20
    nodes.sort((a, b) => a.priority - b.priority);
    let isTruncated = false;
    const cappedNodes = nodes.slice(0, 20);
    if (nodes.length > 20) {
      isTruncated = true;
    }

    const cappedNodeIds = new Set(cappedNodes.map((n) => n.id));

    // 5. Define Mermaid Edges
    const edges: { from: string; to: string; label: string }[] = [];

    // Requirement -> High level entrypoints (API, or Services if no API)
    const entrypoints = cappedNodes.filter((n) => n.priority === 2);
    if (entrypoints.length > 0) {
      entrypoints.forEach((n) => {
        edges.push({ from: 'n_req', to: n.id, label: 'AFFECTS' });
      });
    } else {
      const topServices = cappedNodes.filter((n) => n.priority >= 3 && n.priority < 4);
      topServices.forEach((n) => {
        edges.push({ from: 'n_req', to: n.id, label: 'AFFECTS' });
      });
    }

    // Dependency Edges between impacted artifacts
    for (const edge of dependencyEdges) {
      if (impactedArtifactIds.has(edge.fromArtifactId) && impactedArtifactIds.has(edge.toArtifactId)) {
        const fromNodeId = this.generateNodeId(edge.fromArtifactId);
        const toNodeId = this.generateNodeId(edge.toArtifactId);

        // Only add edge if BOTH nodes are in the capped node list
        if (cappedNodeIds.has(fromNodeId) && cappedNodeIds.has(toNodeId)) {
          edges.push({
            from: fromNodeId,
            to: toNodeId,
            label: edge.type,
          });
        }
      }
    }

    // Cap edges at 30
    if (edges.length > 30) {
      isTruncated = true;
      edges.splice(30);
    }

    // 6. Build Mermaid String
    const lines = ['```mermaid', 'flowchart TD'];
    
    // Print nodes
    for (const node of cappedNodes) {
      lines.push(`  ${node.id}["${node.label}"]`);
    }

    lines.push('');

    // Print edges
    for (const edge of edges) {
      // Mermaid dashed or solid depending on type
      if (edge.label === 'TESTS') {
        lines.push(`  ${edge.from} -.-|${edge.label}| ${edge.to}`);
      } else {
        lines.push(`  ${edge.from} -->|${edge.label}| ${edge.to}`);
      }
    }

    lines.push('```');

    return {
      mermaid: lines.join('\n'),
      isTruncated,
    };
  }

  private generateNodeId(uuid: string): string {
    // Mermaid safe node ID: n_<alphanumeric hash part>
    return `n_${uuid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)}`;
  }

  private escapeLabel(label: string): string {
    if (!label) return 'Unknown';
    // Remove quotes, backticks, brackets, newlines, limit length
    let safe = label.replace(/["'`\n\r[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    if (safe.length > 60) {
      safe = safe.substring(0, 57) + '...';
    }
    return safe || 'Unknown';
  }
}
