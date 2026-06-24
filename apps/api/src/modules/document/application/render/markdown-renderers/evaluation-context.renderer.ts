import { EvaluationContextAdapter } from '../../evaluation-context.adapter';

export function renderEvaluationContext(evalContext: ReturnType<EvaluationContextAdapter['getEvaluationContext']>): string[] {
  const lines: string[] = [];

  if (evalContext) {
    lines.push('## Evaluation Context');
    lines.push('');
    lines.push(`- **Dataset Version**: \`${evalContext.datasetVersion}\``);
    lines.push(`- **Subset ID**: \`${evalContext.subsetId}\``);
    lines.push(`- **Subset Size**: \`${evalContext.subsetSize}\` (Illustrative Only)`);
    lines.push(`- **Interpretation**: \`${evalContext.interpretation}\``);
    lines.push(`- **Research Artifact**: \`${evalContext.researchFindingsArtifact}\``);
    lines.push(`- **Comparison Artifact**: \`${evalContext.sameSubsetComparisonArtifact}\``);
    lines.push('');
    
    if (evalContext.knownLimits.length > 0) {
      lines.push('### Known Limits');
      evalContext.knownLimits.forEach(l => lines.push(`- ${l}`));
      lines.push('');
    }

    if (evalContext.evidenceQualityNotes.length > 0) {
      lines.push('### Evidence Quality Notes');
      evalContext.evidenceQualityNotes.forEach(l => lines.push(`- ${l}`));
      lines.push('');
    }

    if (evalContext.datasetExpansionRecommendations.length > 0) {
      lines.push('### Dataset Expansion Recommendations');
      evalContext.datasetExpansionRecommendations.forEach(l => lines.push(`- ${l}`));
      lines.push('');
    }
  }

  return lines;
}
