import { MarkdownReportRenderContext } from '../../markdown-impact-report.types';
import { parseQaScenarioParts } from './markdown-render-utils';
import { getReportLabels } from '../report-localization';

export function renderQaSection(context: MarkdownReportRenderContext): string[] {
  const { insights, reviewNotes } = context;
  const labels = getReportLabels(context.locale);
  const lines: string[] = [];

  const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
  const qaScenarios = approvedInsights.filter(i => i.insightType === 'QA_SCENARIO');

  if (qaScenarios.length > 0) {
    lines.push(`## ${labels.qaScenarios}`);
    lines.push('');
    for (const qa of qaScenarios) {
      lines.push(`### ${qa.title}`);
      lines.push('');
      const parts = parseQaScenarioParts(qa.description || qa.title);
      
      if (parts.precondition !== '-' && parts.action !== '-' && parts.expected !== '-') {
        lines.push(`- **Given:** ${parts.precondition}`);
        lines.push(`- **When:** ${parts.action}`);
        lines.push(`- **Then:** ${parts.expected}`);
      } else {
        lines.push(`- ${qa.description || qa.title}`);
      }
      
      lines.push('');
      const qaNote = reviewNotes.find(n => n.insightId === qa.id);
      if (qaNote) {
        lines.push(`> **${labels.reviewerNote}:** ${qaNote.body}`);
        lines.push('');
      }
    }
  }

  return lines;
}
