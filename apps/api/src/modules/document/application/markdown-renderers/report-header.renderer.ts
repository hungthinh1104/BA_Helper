import { MarkdownReportRenderContext } from '../markdown-impact-report.types';

export function renderReportHeader(context: MarkdownReportRenderContext): string[] {
  const { analysis, metadata } = context;
  const lines: string[] = [];

  lines.push(`# Impact Analysis Report: ${analysis.requirementRevision.title}`);
  lines.push('');
  lines.push(`**Status:** Approved  `);
  lines.push(`**Requirement:** ${analysis.requirementRevision.title}  `);
  lines.push(`**Snapshot Commit:** \`${analysis.snapshot.commitSha}\`  `);
  lines.push(`**Repository:** \`${analysis.snapshot.repository.canonicalUrl}\`  `);
  lines.push(`**Target Ref:** \`${analysis.sourceTarget.requestedRef}\`  `);
  lines.push(`**Generated At:** ${(metadata?.generatedAt ?? new Date().toISOString()).split('T')[0]}  `);
  lines.push('');

  lines.push('## Requirement');
  lines.push('');
  lines.push(`> ${analysis.requirementRevision.rawText.split('\n').join('\n> ')}`);
  lines.push('');

  if (metadata) {
    lines.push('## Provenance');
    lines.push('');
    lines.push(`- Analysis ID: \`${metadata.analysisId}\``);
    lines.push(`- Generated Document ID: \`${metadata.generatedDocumentId}\``);
    lines.push(`- Project ID: \`${metadata.projectId}\``);
    lines.push(`- Repository ID: \`${metadata.repositoryId}\``);
    lines.push(`- Snapshot ID: \`${metadata.snapshotId}\``);
    lines.push(`- Target Ref: \`${metadata.targetRef}\``);
    lines.push(`- Commit SHA: \`${metadata.commitSha}\``);
    lines.push(`- Analyzer Version: \`${metadata.analyzerVersion}\``);
    lines.push(`- Finalized At: ${metadata.finalizedAt ?? metadata.generatedAt}`);
    lines.push('');
  }

  const diagnostics = (analysis.snapshot.diagnostics as any as any[]) || [];
  const capabilitySummary = diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
  const unsupportedDiagnostics = diagnostics.filter(d => 
    d.code !== 'SCANNER_CAPABILITY_SUMMARY' && 
    (d.code.includes('UNSUPPORTED') || d.severity === 'WARN' || d.severity === 'ERROR')
  );

  if (capabilitySummary?.payload) {
    lines.push('## Scanner Capability Profile');
    lines.push('');
    const p = capabilitySummary.payload;
    lines.push(`- **Language:** ${p.language}`);
    if (p.framework) lines.push(`- **Framework:** ${p.framework}`);
    lines.push(`- **Maturity Status:** ${p.status}`);
    lines.push(`- **Confidence Level:** ${p.confidence}`);
    lines.push('');
  }

  if (unsupportedDiagnostics.length > 0) {
    lines.push('## Scanner Diagnostics & Risks');
    lines.push('');
    for (const diag of unsupportedDiagnostics) {
      lines.push(`- **${diag.code}**: ${diag.message}`);
    }
    lines.push('');
  }

  return lines;
}
