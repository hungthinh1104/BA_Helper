import { MarkdownReportRenderContext } from '../markdown-impact-report.types';
import { formatArtifactType } from './markdown-render-utils';

export function renderImpactDiff(context: MarkdownReportRenderContext): string[] {
  const { diff } = context;
  const lines: string[] = [];

  if (diff) {
    lines.push('## Impact Diff Snapshot');
    lines.push('');
    lines.push(`This analysis was derived from baseline analysis: \`${diff.baseAnalysisId}\``);
    lines.push('');
    lines.push('### Summary');
    lines.push(`- Added code impacts: ${diff.summary.addedImpacts}`);
    lines.push(`- Removed code impacts: ${diff.summary.removedImpacts}`);
    lines.push(`- Resolved unknowns: ${diff.summary.resolvedUnknowns}`);
    lines.push(`- New unknowns: ${diff.summary.newUnknowns}`);
    lines.push(`- Added QA scenarios: ${diff.summary.addedQaScenarios}`);
    lines.push('');

    if (diff.addedArtifacts && diff.addedArtifacts.length > 0) {
      lines.push('### Added Code Impacts');
      lines.push('');
      for (const art of diff.addedArtifacts) {
        lines.push(`- \`${art.name}\` (${formatArtifactType(art.artifactType)}) in \`${art.filePath}\``);
      }
      lines.push('');
    }

    if (diff.removedArtifacts && diff.removedArtifacts.length > 0) {
      lines.push('### Removed Code Impacts');
      lines.push('');
      for (const art of diff.removedArtifacts) {
        lines.push(`- \`${art.name}\` (${formatArtifactType(art.artifactType)}) in \`${art.filePath}\``);
      }
      lines.push('');
    }

    if (diff.resolvedUnknowns && diff.resolvedUnknowns.length > 0) {
      lines.push('### Resolved Unknowns');
      lines.push('');
      for (const unk of diff.resolvedUnknowns) {
        lines.push(`- ${unk.statement}`);
      }
      lines.push('');
    }

    if (diff.newUnknowns && diff.newUnknowns.length > 0) {
      lines.push('### New Unknowns');
      lines.push('');
      for (const unk of diff.newUnknowns) {
        lines.push(`- ${unk.statement}`);
      }
      lines.push('');
    }

    if (diff.addedQaScenarios && diff.addedQaScenarios.length > 0) {
      lines.push('### Added QA Scenarios');
      lines.push('');
      for (const qa of diff.addedQaScenarios) {
        lines.push(`- **${qa.insightKey || qa.statement}**: ${qa.statement}`);
      }
      lines.push('');
    }
  }

  return lines;
}
