import { MarkdownReportRenderContext } from '../../markdown-impact-report.types';
import { resolveArtifactDisplayType } from './markdown-render-utils';
import { getReportLabels } from '../report-localization';

export function renderExecutiveSummary(context: MarkdownReportRenderContext, diagramResult: { mermaid: string; isTruncated: boolean }): string[] {
  const { insights, traceabilityLinks, hasUnreviewedItems } = context;
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
