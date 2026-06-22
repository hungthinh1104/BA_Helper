import { MarkdownReportRenderContext } from '../markdown-impact-report.types';

export function renderEvidenceAppendix(context: MarkdownReportRenderContext): string[] {
  const { insights } = context;
  const lines: string[] = [];

  const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
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

  return lines;
}
