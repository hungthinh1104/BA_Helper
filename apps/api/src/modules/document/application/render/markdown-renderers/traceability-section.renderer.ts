import type { MarkdownReportRenderContext } from '../../markdown-impact-report.types';
import { resolveArtifactDisplayType } from './markdown-render-utils';
import { EvidenceQualityAnnotator } from '../../evidence-quality.annotator';
import { getReportLabels } from '../report-localization';

export function renderImpactedAreas(context: MarkdownReportRenderContext): string[] {
  const { analysis, traceabilityLinks, reviewNotes } = context;
  const labels = getReportLabels(context.locale);
  const lines: string[] = [];

  if (traceabilityLinks.length === 0) {
    return lines;
  }

  const diagnostics = (analysis.snapshot.diagnostics as any as any[]) || [];
  const capabilitySummary = diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');

  lines.push(`## ${labels.impactedAreas}`);
  lines.push('');
  // Group links by type
  const groupedLinks = new Map<string, typeof traceabilityLinks>();
  const sortedLinks = [...traceabilityLinks].sort((a, b) => a.reviewStatus.localeCompare(b.reviewStatus));
  
  for (const link of sortedLinks) {
    const type = resolveArtifactDisplayType(link.artifact);
    if (!groupedLinks.has(type)) {
      groupedLinks.set(type, []);
    }
    groupedLinks.get(type)!.push(link);
  }

  for (const [type, links] of groupedLinks.entries()) {
    lines.push(`### ${type}`);
    lines.push('');
    for (const link of links) {
      const nameRaw = link.artifact?.name ? `\`${link.artifact.name}\`` : labels.unknown;
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
        methodLabel = ` **[${labels.methodUnknown}]**`;
      }

      const name = nameRaw + maturityLabel + methodLabel;
      const file = link.artifact?.filePath ? `\`${link.artifact.filePath}\`` : labels.unknown;
      const status = link.reviewStatus === 'CONFIRMED' ? labels.confirmed : link.reviewStatus === 'NEEDS_REVIEW' ? labels.needsReview : link.reviewStatus;
      
      lines.push(`- ${name} in ${file} — **${status}**`);
    }
    lines.push('');
  }

  const linkNotes = reviewNotes.filter(n => n.traceabilityLinkId && traceabilityLinks.some(l => l.id === n.traceabilityLinkId));
  if (linkNotes.length > 0) {
    lines.push(`### ${labels.reviewerNotesOnImpactedAreas}`);
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
  const { traceabilityLinks, reviewDecisionsSnapshot, evidenceQualitySummarySnapshot } = context;
  const labels = getReportLabels(context.locale);
  const lines: string[] = [];

  if (traceabilityLinks.length === 0) {
    return lines;
  }

  lines.push(`## ${labels.evidenceQuality}`);
  lines.push('');

  if (evidenceQualitySummarySnapshot) {
    const summary = evidenceQualitySummarySnapshot;
    lines.push(`- ${labels.strongSourceEvidence}: ${readSummaryCount(summary, 'strongSourceEvidence', 'evidenced', 'STRONG_SOURCE_EVIDENCE')}`);
    lines.push(`- ${labels.weakSourceEvidence}: ${readSummaryCount(summary, 'weakSourceEvidence', 'weakEvidence', 'WEAK_SOURCE_EVIDENCE')}`);
    lines.push(`- ${labels.inferredFromStructure}: ${readSummaryCount(summary, 'inferredFromStructure', 'inferred', 'INFERRED_FROM_STRUCTURE')}`);
    lines.push(`- ${labels.domainHintOnly}: ${readSummaryCount(summary, 'domainHintOnly', 'DOMAIN_HINT_ONLY')}`);
    lines.push(`- ${labels.missingEvidence}: ${readSummaryCount(summary, 'missingEvidence', 'MISSING_EVIDENCE')}`);
    lines.push(`- ${labels.conflictingEvidence}: ${readSummaryCount(summary, 'conflictingEvidence', 'CONFLICTING_EVIDENCE')}`);
    lines.push(`- ${labels.reviewRequired}: ${readSummaryCount(summary, 'reviewRequired', 'REVIEW_REQUIRED')}`);
  } else {
    const linkAnnotations = traceabilityLinks.map(link => ({
      link,
      annotation: EvidenceQualityAnnotator.annotate(link as any)
    }));

    const summary = EvidenceQualityAnnotator.summarize(linkAnnotations.map((item) => item.annotation));
    lines.push(`- ${labels.strongSourceEvidence}: ${summary.strongSourceEvidence}`);
    lines.push(`- ${labels.weakSourceEvidence}: ${summary.weakSourceEvidence}`);
    lines.push(`- ${labels.inferredFromStructure}: ${summary.inferredFromStructure}`);
    lines.push(`- ${labels.domainHintOnly}: ${summary.domainHintOnly}`);
    lines.push(`- ${labels.missingEvidence}: ${summary.missingEvidence}`);
    lines.push(`- ${labels.conflictingEvidence}: ${summary.conflictingEvidence}`);
    lines.push(`- ${labels.reviewRequired}: ${summary.reviewRequired}`);
  }

  lines.push('');
  lines.push(`| ${labels.artifact} | ${labels.quality} | ${labels.reason} |`);
  lines.push('|---|---|---|');
  
  if (reviewDecisionsSnapshot) {
    for (const item of reviewDecisionsSnapshot) {
      lines.push(`| \`${item.artifact}\` | ${item.quality} | ${item.reasons.join(', ')} |`);
    }
  } else {
    const linkAnnotations = traceabilityLinks.map(link => ({
      link,
      annotation: EvidenceQualityAnnotator.annotate(link as any)
    }));

    for (const item of linkAnnotations) {
      const artifactName = item.link.artifact?.filePath ? `\`${item.link.artifact.filePath}\`` : (item.link.artifact?.name || labels.unknown);
      lines.push(`| ${artifactName} | ${item.annotation.label} | ${item.annotation.reasons.join(', ')} |`);
    }
  }
  lines.push('');

  return lines;
}

function readSummaryCount(summary: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = summary[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}
