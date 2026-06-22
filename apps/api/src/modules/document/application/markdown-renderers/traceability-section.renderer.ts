import { MarkdownReportRenderContext } from '../markdown-impact-report.types';
import { resolveArtifactDisplayType } from './markdown-render-utils';
import { EvidenceQualityAnnotator } from '../evidence-quality.annotator';

export function renderImpactedAreas(context: MarkdownReportRenderContext): string[] {
  const { analysis, traceabilityLinks, reviewNotes } = context;
  const lines: string[] = [];

  if (traceabilityLinks.length === 0) {
    return lines;
  }

  const diagnostics = (analysis.snapshot.diagnostics as any as any[]) || [];
  const capabilitySummary = diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');

  lines.push('## Impacted Areas');
  lines.push('');
  lines.push('| Area | Artifact | File | Review Status |');
  lines.push('|---|---|---|---|');
  
  const sortedLinks = [...traceabilityLinks].sort((a, b) => a.reviewStatus.localeCompare(b.reviewStatus));
  for (const link of sortedLinks) {
    const type = resolveArtifactDisplayType(link.artifact);
    const nameRaw = link.artifact?.name ? `\`${link.artifact.name}\`` : 'Unknown';
    let maturityLabel = '';
    if (capabilitySummary?.payload) {
      const p = capabilitySummary.payload;
      if (p.status && p.status !== 'STABLE') {
        maturityLabel = ` (${p.status})`;
      }
    } else if (link.artifact?.artifactKey?.startsWith('go_') || link.artifact?.artifactKey?.startsWith('java_')) {
      maturityLabel = link.artifact.artifactKey.startsWith('go_') ? ' (EXPERIMENTAL)' : ' (PARTIAL)';
    }
    
    let methodLabel = '';
    if (link.artifact?.name?.includes('UNKNOWN')) {
      methodLabel = ' **[Method: UNKNOWN]**';
    }

    const name = nameRaw + maturityLabel + methodLabel;
    const file = link.artifact?.filePath ? `\`${link.artifact.filePath}\`` : 'Unknown';
    const status = link.reviewStatus === 'CONFIRMED' ? 'Confirmed' : link.reviewStatus === 'NEEDS_REVIEW' ? 'Needs Review' : link.reviewStatus;
    lines.push(`| ${type} | ${name} | ${file} | ${status} |`);
  }
  lines.push('');

  const linkNotes = reviewNotes.filter(n => n.traceabilityLinkId && traceabilityLinks.some(l => l.id === n.traceabilityLinkId));
  if (linkNotes.length > 0) {
    lines.push('### Reviewer Notes on Impacted Areas');
    lines.push('');
    for (const note of linkNotes) {
      const link = traceabilityLinks.find(l => l.id === note.traceabilityLinkId);
      if (link?.artifact?.name) {
        lines.push(`- \`${link.artifact.name}\`: ${note.body}`);
      }
    }
    lines.push('');
  }

  return lines;
}

export function renderEvidenceQuality(context: MarkdownReportRenderContext): string[] {
  const { traceabilityLinks } = context;
  const lines: string[] = [];

  if (traceabilityLinks.length === 0) {
    return lines;
  }

  const linkAnnotations = traceabilityLinks.map(link => ({
    link,
    annotation: EvidenceQualityAnnotator.annotate(link as any)
  }));

  const evidencedCount = linkAnnotations.filter(l => l.annotation.label === 'EVIDENCED' || l.annotation.label === 'WEAK_EVIDENCE').length;
  const inferredCount = linkAnnotations.filter(l => l.annotation.label === 'INFERRED').length;
  const reviewRequiredCount = linkAnnotations.filter(l => l.annotation.label === 'REVIEW_REQUIRED').length;

  lines.push('## Evidence Quality & Dataset Readiness');
  lines.push('');
  lines.push(`- Evidence-backed links: ${evidencedCount}`);
  lines.push(`- Inferred links: ${inferredCount}`);
  lines.push(`- Review required: ${reviewRequiredCount}`);
  lines.push('');
  lines.push('| Artifact | Quality | Reason |');
  lines.push('|---|---|---|');
  
  for (const item of linkAnnotations) {
    const artifactName = item.link.artifact?.filePath ? `\`${item.link.artifact.filePath}\`` : (item.link.artifact?.name || 'Unknown');
    lines.push(`| ${artifactName} | ${item.annotation.label} | ${item.annotation.reasons.join(', ')} |`);
  }
  lines.push('');

  return lines;
}
