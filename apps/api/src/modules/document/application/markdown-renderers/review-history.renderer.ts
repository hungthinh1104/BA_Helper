import { MarkdownReportRenderContext } from '../markdown-impact-report.types';

export function renderReviewHistory(context: MarkdownReportRenderContext): string[] {
  const { reviewDecisions } = context;
  const lines: string[] = [];

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

  return lines;
}
