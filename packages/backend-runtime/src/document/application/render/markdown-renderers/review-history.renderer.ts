import type { MarkdownReportRenderContext } from '../../markdown-impact-report.types';
import { getReportLabels } from '../report-localization';

export function renderReviewHistory(context: MarkdownReportRenderContext): string[] {
  const { reviewDecisions } = context;
  const labels = getReportLabels(context.locale);
  const lines: string[] = [];

  if (reviewDecisions && reviewDecisions.length > 0) {
    lines.push(`## ${labels.reviewDecisionHistory}`);
    lines.push('');
    lines.push(`| ${labels.time} | ${labels.reviewer} | ${labels.decision} | ${labels.note} |`);
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

  return lines;
}
