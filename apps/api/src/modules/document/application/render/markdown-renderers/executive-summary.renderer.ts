import { MarkdownReportRenderContext } from '../../markdown-impact-report.types';
import { resolveArtifactDisplayType } from './markdown-render-utils';

export function renderExecutiveSummary(context: MarkdownReportRenderContext, diagramResult: { mermaid: string; isTruncated: boolean }): string[] {
  const { insights, traceabilityLinks, hasUnreviewedItems } = context;
  const lines: string[] = [];

  const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
  const rejectedCount = insights.length - approvedInsights.length;

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

  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`This analysis identified ${claims.length} evidence-backed impacts, ${qaScenarios.length} QA scenarios, and ${openQuestions.length} open questions.`);
  
  if (traceabilityLinks.length > 0) {
    const topAreas = Array.from(
      new Set(traceabilityLinks.map((l) => resolveArtifactDisplayType(l.artifact))),
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

  return lines;
}
