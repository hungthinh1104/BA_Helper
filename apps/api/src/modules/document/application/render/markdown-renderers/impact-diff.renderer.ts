import { MarkdownReportRenderContext } from '../../markdown-impact-report.types';
import { formatArtifactType } from './markdown-render-utils';
import { getReportLabels } from '../report-localization';

export function renderImpactDiff(context: MarkdownReportRenderContext): string[] {
  const { diff } = context;
  const labels = getReportLabels(context.locale);
  const lines: string[] = [];

  if (diff) {
    lines.push(`## ${labels.impactDiffSnapshot}`);
    lines.push('');
    lines.push(`${labels.derivedFromBaseline}: \`${diff.baseAnalysisId}\``);
    lines.push('');
    lines.push(`### ${labels.summary}`);
    lines.push(`- ${labels.addedCodeImpacts}: ${diff.summary.addedImpacts}`);
    lines.push(`- ${labels.removedCodeImpacts}: ${diff.summary.removedImpacts}`);
    lines.push(`- ${labels.resolvedUnknowns}: ${diff.summary.resolvedUnknowns}`);
    lines.push(`- ${labels.newUnknowns}: ${diff.summary.newUnknowns}`);
    lines.push(`- ${labels.addedQaScenarios}: ${diff.summary.addedQaScenarios}`);
    lines.push('');

    if (diff.addedArtifacts && diff.addedArtifacts.length > 0) {
      lines.push(`### ${formatDiffHeading(labels.addedCodeImpacts, context.locale)}`);
      lines.push('');
      for (const art of diff.addedArtifacts) {
        lines.push(`- \`${art.name}\` (${formatArtifactType(art.artifactType)}) in \`${art.filePath}\``);
      }
      lines.push('');
    }

    if (diff.removedArtifacts && diff.removedArtifacts.length > 0) {
      lines.push(`### ${formatDiffHeading(labels.removedCodeImpacts, context.locale)}`);
      lines.push('');
      for (const art of diff.removedArtifacts) {
        lines.push(`- \`${art.name}\` (${formatArtifactType(art.artifactType)}) in \`${art.filePath}\``);
      }
      lines.push('');
    }

    if (diff.resolvedUnknowns && diff.resolvedUnknowns.length > 0) {
      lines.push(`### ${formatDiffHeading(labels.resolvedUnknowns, context.locale)}`);
      lines.push('');
      for (const unk of diff.resolvedUnknowns) {
        lines.push(`- ${unk.statement}`);
      }
      lines.push('');
    }

    if (diff.newUnknowns && diff.newUnknowns.length > 0) {
      lines.push(`### ${formatDiffHeading(labels.newUnknowns, context.locale)}`);
      lines.push('');
      for (const unk of diff.newUnknowns) {
        lines.push(`- ${unk.statement}`);
      }
      lines.push('');
    }

    if (diff.addedQaScenarios && diff.addedQaScenarios.length > 0) {
      lines.push(`### ${formatDiffHeading(labels.addedQaScenarios, context.locale)}`);
      lines.push('');
      for (const qa of diff.addedQaScenarios) {
        lines.push(`- **${qa.insightKey || qa.statement}**: ${qa.statement}`);
      }
      lines.push('');
    }
  }

  return lines;
}

function formatDiffHeading(value: string, locale: string): string {
  if (locale !== 'en') {
    return value;
  }

  return value
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
