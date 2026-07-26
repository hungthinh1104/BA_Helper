import type { EvaluationContextAdapter } from '../../evaluation-context.adapter';
import type { ReportLocale} from '../report-localization';
import { getReportLabels } from '../report-localization';

export function renderEvaluationContext(
  evalContext: ReturnType<EvaluationContextAdapter['getEvaluationContext']>,
  locale: ReportLocale,
): string[] {
  const labels = getReportLabels(locale);
  const lines: string[] = [];

  if (evalContext) {
    lines.push(`## ${labels.evaluationContext}`);
    lines.push('');
    lines.push(`- **${labels.datasetVersion}**: \`${evalContext.datasetVersion}\``);
    lines.push(`- **${labels.subsetId}**: \`${evalContext.subsetId}\``);
    lines.push(`- **${labels.subsetSize}**: \`${evalContext.subsetSize}\` (${labels.illustrativeOnly})`);
    lines.push(`- **${labels.interpretation}**: \`${evalContext.interpretation}\``);
    lines.push(`- **${labels.researchArtifact}**: \`${evalContext.researchFindingsArtifact}\``);
    lines.push(`- **${labels.comparisonArtifact}**: \`${evalContext.sameSubsetComparisonArtifact}\``);
    lines.push('');
    
    if (evalContext.knownLimits.length > 0) {
      lines.push(`### ${labels.knownLimits}`);
      evalContext.knownLimits.forEach(l => lines.push(`- ${l}`));
      lines.push('');
    }

    if (evalContext.evidenceQualityNotes.length > 0) {
      lines.push(`### ${labels.evidenceQualityNotes}`);
      evalContext.evidenceQualityNotes.forEach(l => lines.push(`- ${l}`));
      lines.push('');
    }

    if (evalContext.datasetExpansionRecommendations.length > 0) {
      lines.push(`### ${labels.datasetExpansionRecommendations}`);
      evalContext.datasetExpansionRecommendations.forEach(l => lines.push(`- ${l}`));
      lines.push('');
    }
  }

  return lines;
}
