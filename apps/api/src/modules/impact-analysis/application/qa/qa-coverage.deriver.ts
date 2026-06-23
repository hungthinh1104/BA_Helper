import { Injectable, Logger } from '@nestjs/common';
import { QaCoverageResponse, QaCoverageItem, QaCoverageStatus, QaCoverageSeverity } from '@ba-helper/contracts';
import { ImpactGraphResponse } from '@ba-helper/contracts';

const MONITORED_TYPES = ["CONTROLLER", "API_ROUTE", "SERVICE", "SERVICE_METHOD", "ENTITY"];

@Injectable()
export class QaCoverageDeriver {
  private readonly logger = new Logger(QaCoverageDeriver.name);

  derive(analysisId: string, graphData: ImpactGraphResponse): QaCoverageResponse {
    const { nodes, edges, snapshotId } = graphData;
    const artifacts = nodes.filter(n => MONITORED_TYPES.includes(n.type));

    const coveredSet = new Set<string>();
    const nodeToTests = new Map<string, { id: string; label: string; filePath?: string }[]>();

    // 1. Identify direct coverage using TESTS edges.
    edges.filter(e => e.type === "TESTS").forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (sourceNode && MONITORED_TYPES.includes(sourceNode.type)) {
        coveredSet.add(sourceNode.id);
        if (targetNode) {
          const existing = nodeToTests.get(sourceNode.id) || [];
          existing.push({ id: targetNode.id.replace('artifact-', ''), label: targetNode.label, filePath: targetNode.filePath });
          nodeToTests.set(sourceNode.id, existing);
        }
      }
      
      if (targetNode && MONITORED_TYPES.includes(targetNode.type)) {
        coveredSet.add(targetNode.id);
        if (sourceNode) {
          const existing = nodeToTests.get(targetNode.id) || [];
          existing.push({ id: sourceNode.id.replace('artifact-', ''), label: sourceNode.label, filePath: sourceNode.filePath });
          nodeToTests.set(targetNode.id, existing);
        }
      }
    });

    // 2. Identify indirect coverage (BFS from covered nodes)
    const indirectSet = new Set<string>();
    const queue = Array.from(coveredSet);

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      // Find all nodes called/referenced by `current`.
      const outgoingDeps = edges.filter(e => 
        (e.type === "CALLS" || e.type === "REFERENCES") && 
        e.source === current
      );

      for (const dep of outgoingDeps) {
        if (!coveredSet.has(dep.target) && !indirectSet.has(dep.target)) {
          const targetNode = nodes.find(n => n.id === dep.target);
          if (targetNode && MONITORED_TYPES.includes(targetNode.type)) {
            indirectSet.add(dep.target);
            queue.push(dep.target);
          }
        }
      }
    }

    // 3. Build result
    let coveredCount = 0;
    let indirectCount = 0;
    let noTestCount = 0;
    let highSeverityGapsCount = 0;

    const items: QaCoverageItem[] = artifacts.map(node => {
      let status: QaCoverageStatus = "NO_TEST_FOUND";
      if (coveredSet.has(node.id)) status = "COVERED";
      else if (indirectSet.has(node.id)) status = "INDIRECT_ONLY";

      let severity: QaCoverageSeverity = "LOW";
      if (node.type === "API_ROUTE" || node.type === "SERVICE_METHOD") severity = "HIGH";
      else if (node.type === "SERVICE") severity = "MEDIUM";

      let suggestedAction = "";
      if (status === "COVERED") {
        suggestedAction = "Review existing test to ensure the changed behavior is asserted.";
      } else if (status === "INDIRECT_ONLY") {
        suggestedAction = severity === "HIGH" 
          ? "High risk. Add direct tests for this behavior." 
          : "Consider adding direct tests if this component contains complex logic.";
      } else {
        suggestedAction = severity === "HIGH" 
          ? "Add regression test for this impacted behavior."
          : "Structural artifact. Manual review recommended.";
      }

      const testArtifacts = nodeToTests.get(node.id) || [];

      if (status === "COVERED") coveredCount++;
      else if (status === "INDIRECT_ONLY") indirectCount++;
      else {
        noTestCount++;
        if (severity === "HIGH") highSeverityGapsCount++;
      }

      return {
        artifactId: node.id.replace("artifact-", ""),
        artifactKey: node.artifactKey,
        artifactLabel: node.label,
        artifactType: node.type as any,
        filePath: node.filePath,
        status,
        severity,
        testArtifacts,
        reason: status === "COVERED" ? 'Direct test found' : status === "INDIRECT_ONLY" ? 'Indirectly tested via callers' : 'No tests found in path',
        suggestedAction
      };
    }).sort((a, b) => {
      const statusRank: Record<string, number> = { NO_TEST_FOUND: 0, INDIRECT_ONLY: 1, COVERED: 2 };
      if (statusRank[a.status] !== statusRank[b.status]) {
        return statusRank[a.status] - statusRank[b.status];
      }
      const sevRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return sevRank[a.severity] - sevRank[b.severity];
    });

    return {
      analysisId,
      snapshotId: snapshotId,
      summary: {
        covered: coveredCount,
        indirectOnly: indirectCount,
        noTestFound: noTestCount,
        highSeverityGaps: highSeverityGapsCount,
      },
      items,
    };
  }
}
