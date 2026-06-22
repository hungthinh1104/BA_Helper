import { MarkdownReportRenderContext } from '../markdown-impact-report.types';
import { parseQaScenarioParts } from './markdown-render-utils';

export function renderQaSection(context: MarkdownReportRenderContext): string[] {
  const { insights, reviewNotes } = context;
  const lines: string[] = [];

  const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
  const qaScenarios = approvedInsights.filter(i => i.insightType === 'QA_SCENARIO');

  if (qaScenarios.length > 0) {
    lines.push('## QA Scenarios');
    lines.push('');
    lines.push('| Scenario | Precondition | Action | Expected Result |');
    lines.push('|---|---|---|---|');
    
    for (const qa of qaScenarios) {
      const parts = parseQaScenarioParts(qa.description || qa.title);
      lines.push(`| ${qa.title} | ${parts.precondition} | ${parts.action} | ${parts.expected} |`);
      const qaNote = reviewNotes.find(n => n.insightId === qa.id);
      if (qaNote) {
        lines.push(`| _Reviewer Note_ | ${qaNote.body} | - | - |`);
      }
    }
    lines.push('');
  }

  return lines;
}
