import type { MarkdownReportRenderContext } from '../../markdown-impact-report.types';
import { getReportLabels } from '../report-localization';

export function renderEvidenceAppendix(context: MarkdownReportRenderContext): string[] {
  const { insights } = context;
  const labels = getReportLabels(context.locale);
  const lines: string[] = [];

  const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
  const allEvidence = approvedInsights.flatMap(i => i.evidenceLinks.map(el => ({ insightTitle: i.title, evidence: el.evidence })));
  
  if (allEvidence.length > 0) {
    lines.push(`## ${labels.evidenceAppendix}`);
    lines.push('');
    lines.push(`> ${labels.secretsRedacted}`);
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
      const name = e.sourcePath?.split('/').pop() || labels.unknown;
      lines.push(`### \`${name}\``);
      lines.push('');
      if (e.sourcePath) lines.push(`**${labels.file}:** \`${e.sourcePath}\`  `);
      if (e.startLine && e.endLine) lines.push(`**${labels.lines}:** ${e.startLine}–${e.endLine}`);
      lines.push('');
      lines.push('```ts');
      lines.push(e.excerpt);
      lines.push('```');
      lines.push('');
    }
  }

  return lines;
}
