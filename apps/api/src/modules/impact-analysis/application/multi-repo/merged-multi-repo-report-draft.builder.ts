import { Injectable } from '@nestjs/common';
import { MultiRepoImpactMatrixResponse, ReviewCoverageResponse } from '@ba-helper/contracts';
import { ReportScanHealth, formatSkipReason } from '../qa/scan-health-report.formatter';

type EvidenceItem = {
  id: string;
  sourcePath: string | null;
  startLine: number | null;
  endLine: number | null;
  excerpt: string;
};

type InsightItem = {
  id: string;
  insightType: 'CLAIM' | 'UNKNOWN' | 'QUESTION' | 'ACCEPTANCE_CRITERIA' | 'QA_SCENARIO';
  reviewStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
  title: string;
  description: string;
  reasoning: string | null;
  evidenceLinks: Array<{
    evidence: EvidenceItem;
  }>;
};

type TraceabilityItem = {
  id: string;
  linkType: 'AFFECTED' | 'RELATED';
  reviewStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
  artifact: {
    name: string;
    filePath: string;
    artifactType: string;
    universalKind?: string | null;
  } | null;
  evidenceLinks: Array<{
    evidence: EvidenceItem;
  }>;
};

type ChildDraftInput = {
  analysisId: string;
  repositoryId: string;
  repositoryDisplayName: string;
  snapshotId: string;
  commitSha: string;
  sourceTargetRef: string;
  latestReviewDecision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_CLARIFICATION' | null;
  insights: InsightItem[];
  traceabilityLinks: TraceabilityItem[];
  scanHealth?: ReportScanHealth | null;
};

@Injectable()
export class MergedMultiRepoReportDraftBuilder {
  private formatArtifactKind(artifact: TraceabilityItem['artifact']): string {
    if (!artifact) return 'Unknown';
    return artifact.universalKind ?? artifact.artifactType;
  }

  build(params: {
    runId: string;
    projectId: string;
    requirementRevisionId: string;
    requirementTitle: string;
    requirementRawText: string;
    generatedAt: string;
    children: ChildDraftInput[];
    matrix: MultiRepoImpactMatrixResponse;
    reviewCoverage: ReviewCoverageResponse;
  }) {
    const { children, matrix, reviewCoverage } = params;
    const lines: string[] = [];

    const allInsights = children.flatMap((child) =>
      child.insights
        .filter((insight) => insight.reviewStatus !== 'REJECTED')
        .map((insight) => ({ child, insight })),
    );

    const consolidatedRisks = allInsights.filter(
      ({ insight }) => insight.insightType === 'CLAIM' || insight.insightType === 'UNKNOWN' || insight.insightType === 'QUESTION',
    );
    const qaScenarios = allInsights.filter(
      ({ insight }) => insight.insightType === 'QA_SCENARIO',
    );

    const evidenceMap = new Map<string, { child: ChildDraftInput; evidence: EvidenceItem; source: string }>();
    for (const child of children) {
      for (const insight of child.insights.filter((item) => item.reviewStatus !== 'REJECTED')) {
        for (const link of insight.evidenceLinks) {
          if (!evidenceMap.has(link.evidence.id)) {
            evidenceMap.set(link.evidence.id, {
              child,
              evidence: link.evidence,
              source: `Insight: ${insight.title}`,
            });
          }
        }
      }
      for (const link of child.traceabilityLinks.filter((item) => item.reviewStatus !== 'REJECTED')) {
        for (const evidenceLink of link.evidenceLinks) {
          if (!evidenceMap.has(evidenceLink.evidence.id)) {
            evidenceMap.set(evidenceLink.evidence.id, {
              child,
              evidence: evidenceLink.evidence,
              source: `Traceability: ${link.artifact?.name ?? link.id}`,
            });
          }
        }
      }
    }

    lines.push(`# Multi-repo Merged Report Draft: ${params.requirementTitle}`);
    lines.push('');
    lines.push('## Requirement');
    lines.push('');
    lines.push(`> ${params.requirementRawText.split('\n').join('\n> ')}`);
    lines.push('');

    lines.push('## Run Summary');
    lines.push('');
    lines.push(`- Run ID: \`${params.runId}\``);
    lines.push(`- Project ID: \`${params.projectId}\``);
    lines.push(`- Requirement Revision ID: \`${params.requirementRevisionId}\``);
    lines.push(`- Generated At: ${params.generatedAt}`);
    lines.push(`- Child Analyses: ${children.length}`);
    lines.push('');

    lines.push('## Review Coverage');
    lines.push('');
    lines.push(`Status: ${reviewCoverage.status}`);
    lines.push('');
    lines.push('This is an advisory readiness check. It does not automatically block report finalization or export.');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|---|---:|');
    lines.push(`| Accepted repositories | ${reviewCoverage.summary.acceptedRepositories} / ${reviewCoverage.summary.totalRepositories} |`);
    lines.push(`| Impacted artifacts | ${reviewCoverage.summary.impactedArtifacts} |`);
    lines.push(`| Artifacts without evidence | ${reviewCoverage.summary.uncoveredArtifacts} |`);
    lines.push(`| Risks without QA coverage | ${reviewCoverage.summary.risksWithoutQa} |`);
    lines.push(`| Warning gates | ${reviewCoverage.summary.warningGates} |`);
    lines.push(`| Blocking gates | ${reviewCoverage.summary.blockingGates} |`);
    lines.push('');
    lines.push('### Coverage Gates');
    lines.push('');
    if (reviewCoverage.status === 'PASS' && reviewCoverage.gates.length === 0) {
      lines.push('No review coverage gaps detected.');
    } else {
      lines.push('| Status | Category | Gate | Recommended Action |');
      lines.push('|---|---|---|---|');
      for (const gate of reviewCoverage.gates) {
        lines.push(`| ${gate.status} | ${gate.category} | ${gate.title} | ${gate.recommendedAction} |`);
      }
    }
    lines.push('');

    lines.push('## Cross-domain Impact Matrix');
    lines.push('');
    if (matrix.rows.length === 0) {
      lines.push('No impacted repositories were found for this run.');
    } else {
      lines.push('| Domain | Repository | API | Service | Data | Test | Risks | QA | Review |');
      lines.push('|---|---|---:|---:|---:|---:|---:|---:|---|');
      for (const row of matrix.rows) {
        lines.push(
          `| ${row.domain} | ${row.repositoryDisplayName} | ${row.artifactCounts.API_ENDPOINT} | ${row.artifactCounts.DOMAIN_SERVICE} | ${row.artifactCounts.DATA_MODEL} | ${row.artifactCounts.TEST_CASE} | ${row.riskCount} | ${row.qaScenarioCount} | ${row.latestReviewDecision ?? 'PENDING'} |`
        );
      }
    }
    lines.push('');

    lines.push('## Repository Coverage');
    lines.push('');
    lines.push('| Repository | Analysis ID | Snapshot ID | Commit | Review |');
    lines.push('|---|---|---|---|---|');
    for (const child of children) {
      lines.push(
        `| ${child.repositoryDisplayName} | \`${child.analysisId}\` | \`${child.snapshotId}\` | \`${child.commitSha}\` | ${child.latestReviewDecision ?? 'PENDING'} |`,
      );
    }
    lines.push('');

    lines.push('## Per-repository Analysis');
    lines.push('');
    for (const child of children) {
      lines.push(`### ${child.repositoryDisplayName}`);
      lines.push('');
      lines.push(`- Analysis ID: \`${child.analysisId}\``);
      lines.push(`- Snapshot ID: \`${child.snapshotId}\``);
      lines.push(`- Commit SHA: \`${child.commitSha}\``);
      lines.push(`- Target Ref: \`${child.sourceTargetRef}\``);
      lines.push(`- Latest Review Decision: ${child.latestReviewDecision ?? 'PENDING'}`);
      lines.push('');

      lines.push('#### Scan Health Summary');
      lines.push('');
      if (child.scanHealth) {
        const sh = child.scanHealth;
        let coverageStr = sh.coverageStatus ?? 'UNKNOWN';
        if (coverageStr === 'READY') coverageStr = 'FULL';
        lines.push(`- **Coverage Status**: ${coverageStr}`);
        
        if (coverageStr === 'PARTIAL') {
          lines.push('> PARTIAL means the scanner completed with bounded skips, limits, or pilot-adapter constraints. It does not mean the scan fully failed.');
        }

        if (sh.scannerVersion || sh.analyzerVersion) {
          lines.push(`- **Engine**: ${sh.scannerVersion ?? 'unknown'} / ${sh.analyzerVersion ?? 'unknown'}`);
        }
        lines.push(`- **Files**: ${sh.scannedFileCount ?? 0} scanned, ${sh.skippedFileCount ?? 0} skipped`);
        lines.push(`- **Artifacts Extracted**: ${sh.artifactCount ?? 0}`);

        if (sh.skippedSummary) {
          const sortedSummary = Object.entries(sh.skippedSummary)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);

          if (sortedSummary.length > 0) {
            lines.push('');
            lines.push('**Top Skip Reasons**');
            for (const [reason, count] of sortedSummary) {
              lines.push(`- ${formatSkipReason(reason)} (\`${reason}\`): ${count}`);
            }
          }
        }
      } else {
        lines.push('- No scan health diagnostics available.');
      }
      lines.push('');

      const risks = child.insights.filter(
        (insight) =>
          insight.reviewStatus !== 'REJECTED' &&
          (insight.insightType === 'CLAIM' ||
            insight.insightType === 'UNKNOWN' ||
            insight.insightType === 'QUESTION'),
      );

      lines.push('**Risks and Findings**');
      lines.push('');
      if (risks.length === 0) {
        lines.push('- None.');
      } else {
        for (const insight of risks) {
          lines.push(`- ${insight.title}: ${insight.description}`);
        }
      }
      lines.push('');

      lines.push('**Impacted Artifacts**');
      lines.push('');
      const links = child.traceabilityLinks.filter((link) => link.reviewStatus !== 'REJECTED');
      if (links.length === 0) {
        lines.push('- None.');
      } else {
        for (const link of links) {
          const artifact = link.artifact;
          lines.push(
            `- ${this.formatArtifactKind(artifact)} ${artifact?.name ? `\`${artifact.name}\`` : link.id} (${artifact?.filePath ?? 'unknown path'})`,
          );
        }
      }
      lines.push('');
    }

    lines.push('## Consolidated Risks');
    lines.push('');
    if (consolidatedRisks.length === 0) {
      lines.push('- None.');
    } else {
      for (const { child, insight } of consolidatedRisks) {
        lines.push(`- [${child.repositoryDisplayName}] ${insight.title}: ${insight.description}`);
      }
    }
    lines.push('');

    lines.push('## Consolidated QA Scenarios');
    lines.push('');
    if (qaScenarios.length === 0) {
      lines.push('- None.');
    } else {
      for (const { child, insight } of qaScenarios) {
        lines.push(`- [${child.repositoryDisplayName}] ${insight.title}: ${insight.description}`);
      }
    }
    lines.push('');

    lines.push('## Evidence Appendix');
    lines.push('');
    if (evidenceMap.size === 0) {
      lines.push('- None.');
    } else {
      for (const { child, evidence, source } of evidenceMap.values()) {
        const location =
          evidence.sourcePath && evidence.startLine && evidence.endLine
            ? `${evidence.sourcePath}:${evidence.startLine}-${evidence.endLine}`
            : evidence.sourcePath ?? 'unknown location';
        lines.push(`### ${child.repositoryDisplayName} — ${source}`);
        lines.push('');
        lines.push(`- Evidence ID: \`${evidence.id}\``);
        lines.push(`- Location: \`${location}\``);
        lines.push('');
        lines.push('```text');
        lines.push(evidence.excerpt);
        lines.push('```');
        lines.push('');
      }
    }

    lines.push('## Provenance');
    lines.push('');
    for (const child of children) {
      lines.push(`- Repository: ${child.repositoryDisplayName}`);
      lines.push(`  - Analysis ID: \`${child.analysisId}\``);
      lines.push(`  - Repository ID: \`${child.repositoryId}\``);
      lines.push(`  - Snapshot ID: \`${child.snapshotId}\``);
      lines.push(`  - Commit SHA: \`${child.commitSha}\``);
      lines.push(`  - Target Ref: \`${child.sourceTargetRef}\``);
    }
    lines.push('');

    return lines.join('\n');
  }
}
