import type { MarkdownReportRenderContext } from '../../markdown-impact-report.types';
import { resolveArtifactDisplayType } from './markdown-render-utils';
import { getReportLabels } from '../report-localization';

export function renderExecutiveSummary(context: MarkdownReportRenderContext, diagramResult: { mermaid: string; isTruncated: boolean }): string[] {
  const { insights, traceabilityLinks, hasUnreviewedItems, metadata } = context;
  const labels = getReportLabels(context.locale);
  const lines: string[] = [];

  const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
  const rejectedCount = insights.length - approvedInsights.length;

  lines.push(`## ${labels.impactFlowDiagram}`);
  lines.push('');
  lines.push(diagramResult.mermaid);
  lines.push('');
  if (diagramResult.isTruncated) {
    lines.push(`> ${labels.diagramTruncated}`);
    lines.push('');
  }

  const claims = approvedInsights.filter(i => i.insightType === 'CLAIM');
  const qaScenarios = approvedInsights.filter(i => i.insightType === 'QA_SCENARIO');
  const openQuestions = approvedInsights.filter(i => i.insightType === 'QUESTION' || i.insightType === 'UNKNOWN');

  lines.push(`## ${labels.executiveSummary}`);
  lines.push('');
  lines.push(labels.executiveSummaryLine(claims.length, qaScenarios.length, openQuestions.length));

  if (traceabilityLinks.length > 0) {
    const topAreas = Array.from(
      new Set(traceabilityLinks.map((l) => resolveArtifactDisplayType(l.artifact))),
    ).join(' and ');
    lines.push(labels.primaryImpactedAreas(topAreas));
  }

  // Render AI-generated practical executive summary if available
  const aiSummary = readExecutiveSummaryFromMetadata(metadata);
  if (aiSummary) {
    lines.push('');
    lines.push(aiSummary);
  }

  lines.push('');

  if (rejectedCount > 0) {
    lines.push(`> ${labels.rejectedExcluded}`);
    lines.push('');
  }

  if (hasUnreviewedItems) {
    lines.push(`> ${labels.unreviewedAcknowledged}`);
    lines.push('');
  }

  return lines;
}

function readExecutiveSummaryFromMetadata(metadata: MarkdownReportRenderContext['metadata']): string | null {
  if (!metadata) return null;
  const raw = (metadata as any).executiveSummary ?? (metadata as any).analysisExecutiveSummary;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}
