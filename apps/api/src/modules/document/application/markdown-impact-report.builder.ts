import { Injectable } from '@nestjs/common';
import { Prisma, ReviewNote } from '@prisma/client';

type AnalysisSnapshot = Prisma.ImpactAnalysisGetPayload<{
  include: {
    snapshot: { include: { repository: true } };
    sourceTarget: true;
    requirementRevision: true;
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

type TraceabilityLinkWithArtifact = Prisma.TraceabilityLinkGetPayload<{
  include: {
    artifact: true;
  };
}>;

import { MermaidImpactDiagramBuilder, ReportDependencyEdge } from './mermaid-impact-diagram.builder';
import { ClarificationItemDto } from '@ba-helper/contracts';
import { ApprovedReportMetadata } from '../domain/approved-report-metadata';
import { EvaluationContextAdapter } from './evaluation-context.adapter';

@Injectable()
export class MarkdownImpactReportBuilder {
  constructor(
    private readonly mermaidBuilder: MermaidImpactDiagramBuilder,
    private readonly evalContextAdapter: EvaluationContextAdapter
  ) {}

  private resolveArtifactDisplayType(artifact?: { artifactType?: string | null; universalKind?: string | null } | null): string {
    if (!artifact) return 'Unknown';
    if (artifact.universalKind) return this.formatArtifactType(artifact.universalKind);
    if (artifact.artifactType) return this.formatArtifactType(artifact.artifactType);
    return 'Unknown';
  }

  build(params: {
    analysis: AnalysisSnapshot;
    insights: InsightWithEvidence[];
    traceabilityLinks: TraceabilityLinkWithArtifact[];
    reviewNotes?: ReviewNote[];
    hasUnreviewedItems: boolean;
    dependencyEdges?: ReportDependencyEdge[];
    clarifications?: ClarificationItemDto[];
    reviewDecisions?: any[];
    diff?: any;
    metadata?: ApprovedReportMetadata;
  }): string {
    const {
      analysis,
      insights,
      traceabilityLinks,
      reviewNotes = [],
      hasUnreviewedItems,
      dependencyEdges = [],
      clarifications = [],
      reviewDecisions = [],
      diff,
      metadata,
    } = params;
    
    const lines: string[] = [];

    // 1. Header
    lines.push(`# Impact Analysis Report: ${analysis.requirementRevision.title}`);
    lines.push('');
    lines.push(`**Status:** Approved  `);
    lines.push(`**Requirement:** ${analysis.requirementRevision.title}  `);
    lines.push(`**Snapshot Commit:** \`${analysis.snapshot.commitSha}\`  `);
    lines.push(`**Repository:** \`${analysis.snapshot.repository.canonicalUrl}\`  `);
    lines.push(`**Target Ref:** \`${analysis.sourceTarget.requestedRef}\`  `);
    lines.push(`**Generated At:** ${(metadata?.generatedAt ?? new Date().toISOString()).split('T')[0]}  `);
    lines.push('');

    // 2. Requirement
    lines.push('## Requirement');
    lines.push('');
    lines.push(`> ${analysis.requirementRevision.rawText.split('\n').join('\n> ')}`);
    lines.push('');

    if (metadata) {
      lines.push('## Provenance');
      lines.push('');
      lines.push(`- Analysis ID: \`${metadata.analysisId}\``);
      lines.push(`- Generated Document ID: \`${metadata.generatedDocumentId}\``);
      lines.push(`- Project ID: \`${metadata.projectId}\``);
      lines.push(`- Repository ID: \`${metadata.repositoryId}\``);
      lines.push(`- Snapshot ID: \`${metadata.snapshotId}\``);
      lines.push(`- Target Ref: \`${metadata.targetRef}\``);
      lines.push(`- Commit SHA: \`${metadata.commitSha}\``);
      lines.push(`- Analyzer Version: \`${metadata.analyzerVersion}\``);
      lines.push(`- Finalized At: ${metadata.finalizedAt ?? metadata.generatedAt}`);
      lines.push('');
    }

    const diagnostics = (analysis.snapshot.diagnostics as any as any[]) || [];
    const capabilitySummary = diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
    const unsupportedDiagnostics = diagnostics.filter(d => 
      d.code !== 'SCANNER_CAPABILITY_SUMMARY' && 
      (d.code.includes('UNSUPPORTED') || d.severity === 'WARN' || d.severity === 'ERROR')
    );

    if (capabilitySummary?.payload) {
      lines.push('## Scanner Capability Profile');
      lines.push('');
      const p = capabilitySummary.payload;
      lines.push(`- **Language:** ${p.language}`);
      if (p.framework) lines.push(`- **Framework:** ${p.framework}`);
      lines.push(`- **Maturity Status:** ${p.status}`);
      lines.push(`- **Confidence Level:** ${p.confidence}`);
      lines.push('');
    }

    if (unsupportedDiagnostics.length > 0) {
      lines.push('## Scanner Diagnostics & Risks');
      lines.push('');
      for (const diag of unsupportedDiagnostics) {
        lines.push(`- **${diag.code}**: ${diag.message}`);
      }
      lines.push('');
    }

    // Filter approved insights
    const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
    const rejectedCount = insights.length - approvedInsights.length;

    // 2.5 Impact Flow Diagram
    const diagramResult = this.mermaidBuilder.build({
      requirement: analysis.requirementRevision,
      traceabilityLinks,
      dependencyEdges,
      insights,
    });

    lines.push('## Impact Flow Diagram');
    lines.push('');
    lines.push(diagramResult.mermaid);
    lines.push('');
    if (diagramResult.isTruncated) {
      lines.push('> Diagram truncated to the most relevant impacted artifacts. See the Impacted Areas and Evidence Appendix for full details.');
      lines.push('');
    }

    const claims = approvedInsights.filter(i => i.insightType === 'CLAIM');
    const qaScenarios = approvedInsights.filter(i => i.insightType === 'QA_SCENARIO');
    const openQuestions = approvedInsights.filter(i => i.insightType === 'QUESTION' || i.insightType === 'UNKNOWN');
    const acceptanceCriteria = approvedInsights.filter(i => i.insightType === 'ACCEPTANCE_CRITERIA');

    // 3. Executive Summary
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(`This analysis identified ${claims.length} evidence-backed impacts, ${qaScenarios.length} QA scenarios, and ${openQuestions.length} open questions.`);
    
    if (traceabilityLinks.length > 0) {
      const topAreas = Array.from(
        new Set(traceabilityLinks.map((l) => this.resolveArtifactDisplayType(l.artifact))),
      ).join(' and ');
      lines.push(`The primary impacted areas are ${topAreas.toLowerCase()} layers.`);
    }
    lines.push('');

    if (rejectedCount > 0) {
      lines.push(`> Rejected insights are excluded from this approved report.`);
      lines.push('');
    }
    
    if (hasUnreviewedItems) {
      lines.push(`> This report was finalized with unreviewed items acknowledged.`);
      lines.push('');
    }

    // 4. Impacted Areas
    if (traceabilityLinks.length > 0) {
      lines.push('## Impacted Areas');
      lines.push('');
      lines.push('| Area | Artifact | File | Review Status |');
      lines.push('|---|---|---|---|');
      
      const sortedLinks = [...traceabilityLinks].sort((a, b) => a.reviewStatus.localeCompare(b.reviewStatus));
      for (const link of sortedLinks) {
        const type = this.resolveArtifactDisplayType(link.artifact);
        const nameRaw = link.artifact?.name ? `\`${link.artifact.name}\`` : 'Unknown';
        let maturityLabel = '';
        if (capabilitySummary?.payload) {
          const p = capabilitySummary.payload;
          if (p.status && p.status !== 'STABLE') {
            maturityLabel = ` (${p.status})`;
          }
        } else if (link.artifact?.artifactKey?.startsWith('go_') || link.artifact?.artifactKey?.startsWith('java_')) {
          maturityLabel = link.artifact.artifactKey.startsWith('go_') ? ' (EXPERIMENTAL)' : ' (PARTIAL)';
        }
        
        let methodLabel = '';
        if (link.artifact?.name?.includes('UNKNOWN')) {
          methodLabel = ' **[Method: UNKNOWN]**';
        }

        const name = nameRaw + maturityLabel + methodLabel;
        const file = link.artifact?.filePath ? `\`${link.artifact.filePath}\`` : 'Unknown';
        const status = link.reviewStatus === 'CONFIRMED' ? 'Confirmed' : link.reviewStatus === 'NEEDS_REVIEW' ? 'Needs Review' : link.reviewStatus;
        lines.push(`| ${type} | ${name} | ${file} | ${status} |`);
      }
      lines.push('');

      const linkNotes = reviewNotes.filter(n => n.traceabilityLinkId && traceabilityLinks.some(l => l.id === n.traceabilityLinkId));
      if (linkNotes.length > 0) {
        lines.push('### Reviewer Notes on Impacted Areas');
        lines.push('');
        for (const note of linkNotes) {
          const link = traceabilityLinks.find(l => l.id === note.traceabilityLinkId);
          if (link?.artifact?.name) {
            lines.push(`- \`${link.artifact.name}\`: ${note.body}`);
          }
        }
        lines.push('');
      }
    }

    // 5. Evidence-backed Impacts
    if (claims.length > 0) {
      lines.push('## Evidence-backed Impacts');
      lines.push('');
      claims.forEach((claim, index) => {
        lines.push(`### ${index + 1}. ${claim.description || claim.title}`);
        lines.push('');
        lines.push(`**Certainty:** ${this.formatCertainty(claim.certainty)}  `);
        const claimNote = reviewNotes.find(n => n.insightId === claim.id);
        if (claimNote) {
          lines.push(`**Reviewer Note:** ${claimNote.body}  `);
        }
        if (claim.reasoning) {
          lines.push(`**Reasoning:** ${claim.reasoning}  `);
        }
        lines.push('');
        
        if (claim.evidenceLinks.length > 0) {
          lines.push('**Evidence:**');
          const filePaths = new Set(claim.evidenceLinks.map(e => e.evidence.sourcePath).filter(Boolean));
          filePaths.forEach(path => lines.push(`- \`${path}\``));
        } else {
          lines.push('_No evidence attached._');
        }
        lines.push('');
      });
    }

    // 6. Acceptance Criteria
    if (acceptanceCriteria.length > 0) {
      lines.push('## Acceptance Criteria');
      lines.push('');
      for (const ac of acceptanceCriteria) {
        lines.push(`- ${ac.description || ac.title}`);
        const acNote = reviewNotes.find(n => n.insightId === ac.id);
        if (acNote) {
          lines.push(`  <br/>**Reviewer Note:** ${acNote.body}`);
        }
        if (ac.evidenceLinks.length === 0) {
          lines.push(`  <br/>_Not directly evidenced; derived from requirement and should be confirmed._`);
        }
      }
      lines.push('');
    }

    // 7. QA Scenarios
    if (qaScenarios.length > 0) {
      lines.push('## QA Scenarios');
      lines.push('');
      lines.push('| Scenario | Precondition | Action | Expected Result |');
      lines.push('|---|---|---|---|');
      
      for (const qa of qaScenarios) {
        const parts = this.parseQaScenarioParts(qa.description || qa.title);
        lines.push(`| ${qa.title} | ${parts.precondition} | ${parts.action} | ${parts.expected} |`);
        const qaNote = reviewNotes.find(n => n.insightId === qa.id);
        if (qaNote) {
          lines.push(`| _Reviewer Note_ | ${qaNote.body} | - | - |`);
        }
      }
      lines.push('');
    }

    // 8. Open Questions / Unknowns
    if (openQuestions.length > 0) {
      lines.push('## Open Questions / Unknowns');
      lines.push('');
      for (const q of openQuestions) {
        lines.push(`### ${q.title}`);
        lines.push('');
        lines.push(`**Question:** ${q.description || q.title}`);
        lines.push('');
        const qNote = reviewNotes.find(n => n.insightId === q.id);
        if (qNote) {
          lines.push(`**Reviewer Note:** ${qNote.body}`);
          lines.push('');
        }
        if (q.reasoning) {
          lines.push(`**Why this matters:** ${q.reasoning}`);
          lines.push('');
        }
        
        if (q.metadata && typeof q.metadata === 'object' && (q.metadata as any).origin === 'SCANNER_DIAGNOSTIC') {
          lines.push(`_Derived from scanner diagnostic_`);
          lines.push('');
        }
      }
    }

    // 8.5 Clarifications
    if (clarifications.length > 0) {
      lines.push('## Clarifications');
      lines.push('');

      const answered = clarifications.filter(c => c.status === 'ANSWERED' || c.status === 'CONVERTED_TO_REVISION');
      const open = clarifications.filter(c => c.status === 'OPEN');
      const dismissed = clarifications.filter(c => c.status === 'DISMISSED');

      if (answered.length > 0) {
        lines.push('### Answered');
        lines.push('');
        answered.forEach(c => {
          lines.push(`**Question:** ${c.question}  `);
          if (c.reason) lines.push(`**Why this matters:** ${c.reason}  `);
          lines.push(`**Answer:** ${c.answer}  `);
          if (c.status === 'CONVERTED_TO_REVISION' && c.convertedRequirementRevisionId) {
            lines.push(`**Disposition:** Converted to Requirement Revision \`${c.convertedRequirementRevisionId}\``);
          }
          lines.push('');
        });
      }

      if (open.length > 0) {
        lines.push('### Still Open');
        lines.push('');
        open.forEach(c => {
          lines.push(`**Question:** ${c.question}  `);
          if (c.reason) lines.push(`**Why this matters:** ${c.reason}  `);
          lines.push('');
        });
      }

      if (dismissed.length > 0) {
        lines.push('### Dismissed');
        lines.push('');
        dismissed.forEach(c => {
          lines.push(`**Question:** ${c.question}  `);
          lines.push(`**Disposition:** Dismissed during review. ${c.reason ? `Reason: ${c.reason}` : ''}`);
          lines.push('');
        });
      }
    }

    // 9. Evidence Appendix
    const allEvidence = approvedInsights.flatMap(i => i.evidenceLinks.map(el => ({ insightTitle: i.title, evidence: el.evidence })));
    if (allEvidence.length > 0) {
      lines.push('## Evidence Appendix');
      lines.push('');
      lines.push('> Secrets were redacted before storage, embedding, or LLM processing.');
      lines.push('');
      
      // Deduplicate evidence by ID
      const uniqueEvidenceMap = new Map<string, typeof allEvidence[0]>();
      for (const item of allEvidence) {
        if (!uniqueEvidenceMap.has(item.evidence.id)) {
          uniqueEvidenceMap.set(item.evidence.id, item);
        }
      }
      
      const uniqueEvidence = Array.from(uniqueEvidenceMap.values());
      
      for (const item of uniqueEvidence) {
        const e = item.evidence;
        const name = e.sourcePath?.split('/').pop() || 'Unknown';
        lines.push(`### \`${name}\``);
        lines.push('');
        if (e.sourcePath) lines.push(`**File:** \`${e.sourcePath}\`  `);
        if (e.startLine && e.endLine) lines.push(`**Lines:** ${e.startLine}–${e.endLine}`);
        lines.push('');
        lines.push('```ts');
        lines.push(e.excerpt);
        lines.push('```');
        lines.push('');
      }
    }

    if (reviewDecisions && reviewDecisions.length > 0) {
      lines.push('## Review Decision History');
      lines.push('');
      lines.push('| Time | Reviewer | Decision | Note |');
      lines.push('|---|---|---|---|');
      for (const d of reviewDecisions) {
        const time = new Date(d.createdAt).toISOString().replace('T', ' ').substring(0, 19);
        const reviewer = d.reviewedBy;
        const decision = d.decision;
        const note = d.note || '-';
        lines.push(`| ${time} | ${reviewer} | ${decision} | ${note} |`);
      }
      lines.push('');
    }

    const evalContext = this.evalContextAdapter.getEvaluationContext();
    if (evalContext) {
      lines.push('## Evaluation Context');
      lines.push('');
      lines.push(`- **Dataset Version**: \`${evalContext.datasetVersion}\``);
      lines.push(`- **Subset ID**: \`${evalContext.subsetId}\``);
      lines.push(`- **Subset Size**: \`${evalContext.subsetSize}\` (Illustrative Only)`);
      lines.push(`- **Interpretation**: \`${evalContext.interpretation}\``);
      lines.push(`- **Research Artifact**: \`${evalContext.researchFindingsArtifact}\``);
      lines.push(`- **Comparison Artifact**: \`${evalContext.sameSubsetComparisonArtifact}\``);
      lines.push('');
      
      if (evalContext.knownLimits.length > 0) {
        lines.push('### Known Limits');
        evalContext.knownLimits.forEach(l => lines.push(`- ${l}`));
        lines.push('');
      }

      if (evalContext.evidenceQualityNotes.length > 0) {
        lines.push('### Evidence Quality Notes');
        evalContext.evidenceQualityNotes.forEach(l => lines.push(`- ${l}`));
        lines.push('');
      }

      if (evalContext.datasetExpansionRecommendations.length > 0) {
        lines.push('### Dataset Expansion Recommendations');
        evalContext.datasetExpansionRecommendations.forEach(l => lines.push(`- ${l}`));
        lines.push('');
      }
    }

    if (diff) {
      lines.push('## Impact Diff Snapshot');
      lines.push('');
      lines.push(`This analysis was derived from baseline analysis: \`${diff.baseAnalysisId}\``);
      lines.push('');
      lines.push('### Summary');
      lines.push(`- Added code impacts: ${diff.summary.addedImpacts}`);
      lines.push(`- Removed code impacts: ${diff.summary.removedImpacts}`);
      lines.push(`- Resolved unknowns: ${diff.summary.resolvedUnknowns}`);
      lines.push(`- New unknowns: ${diff.summary.newUnknowns}`);
      lines.push(`- Added QA scenarios: ${diff.summary.addedQaScenarios}`);
      lines.push('');

      if (diff.addedArtifacts && diff.addedArtifacts.length > 0) {
        lines.push('### Added Code Impacts');
        lines.push('');
        for (const art of diff.addedArtifacts) {
          lines.push(`- \`${art.name}\` (${this.formatArtifactType(art.artifactType)}) in \`${art.filePath}\``);
        }
        lines.push('');
      }

      if (diff.removedArtifacts && diff.removedArtifacts.length > 0) {
        lines.push('### Removed Code Impacts');
        lines.push('');
        for (const art of diff.removedArtifacts) {
          lines.push(`- \`${art.name}\` (${this.formatArtifactType(art.artifactType)}) in \`${art.filePath}\``);
        }
        lines.push('');
      }

      if (diff.resolvedUnknowns && diff.resolvedUnknowns.length > 0) {
        lines.push('### Resolved Unknowns');
        lines.push('');
        for (const unk of diff.resolvedUnknowns) {
          lines.push(`- ${unk.statement}`);
        }
        lines.push('');
      }

      if (diff.newUnknowns && diff.newUnknowns.length > 0) {
        lines.push('### New Unknowns');
        lines.push('');
        for (const unk of diff.newUnknowns) {
          lines.push(`- ${unk.statement}`);
        }
        lines.push('');
      }

      if (diff.addedQaScenarios && diff.addedQaScenarios.length > 0) {
        lines.push('### Added QA Scenarios');
        lines.push('');
        for (const qa of diff.addedQaScenarios) {
          lines.push(`- **${qa.insightKey || qa.statement}**: ${qa.statement}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n').trim();
  }

  private formatCertainty(certainty: string): string {
    switch (certainty) {
      case 'EVIDENCED': return 'Evidenced';
      case 'INFERRED': return 'Inferred';
      case 'UNKNOWN': return 'Unknown';
      case 'CONFLICTING': return 'Conflicting';
      default: return certainty;
    }
  }

  private formatArtifactType(type: string): string {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  private parseQaScenarioParts(description: string): { precondition: string, action: string, expected: string } {
    // Basic heuristic to split a scenario description if it follows a pattern, otherwise return the whole text as expected result
    let precondition = '-';
    let action = '-';
    let expected = description;
    
    const givenMatch = description.match(/Given (.*?) When /i);
    const whenMatch = description.match(/When (.*?) Then /i);
    const thenMatch = description.match(/Then (.*)/i);
    
    if (givenMatch && whenMatch && thenMatch) {
      precondition = givenMatch[1];
      action = whenMatch[1];
      expected = thenMatch[1];
    }
    
    return { precondition, action, expected };
  }
}
