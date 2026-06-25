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
    lines.push(`| ${labels.scenario} | ${labels.precondition} | ${labels.action} | ${labels.expectedResult} |`);
    lines.push('|---|---|---|---|');
    
    for (const qa of qaScenarios) {
      const parts = parseQaScenarioParts(qa.description || qa.title);
      lines.push(`| ${qa.title} | ${parts.precondition} | ${parts.action} | ${parts.expected} |`);
      const qaNote = reviewNotes.find(n => n.insightId === qa.id);
      if (qaNote) {
        lines.push(`| _${labels.reviewerNote}_ | ${qaNote.body} | - | - |`);
      }
    }
    lines.push('');
  }

  return lines;
}
