import type { MarkdownReportRenderContext } from '../../markdown-impact-report.types';
import { getDomainTerminology, getReportLabels } from '../report-localization';

export function renderReportHeader(context: MarkdownReportRenderContext): string[] {
  const { analysis, metadata } = context;
  const labels = getReportLabels(context.locale);
  const lines: string[] = [];

  lines.push(`# ${labels.titlePrefix}: ${analysis.requirementRevision.title}`);
  lines.push('');
  lines.push(`**${labels.status}:** ${labels.approved}  `);
  lines.push(`**${labels.requirement}:** ${analysis.requirementRevision.title}  `);
  lines.push(`**${labels.snapshotCommit}:** \`${analysis.snapshot.commitSha}\`  `);
  lines.push(`**${labels.repository}:** \`${analysis.snapshot.repository.canonicalUrl}\`  `);
  lines.push(`**${labels.targetRef}:** \`${analysis.sourceTarget.requestedRef}\`  `);
  lines.push(`**${labels.generatedAt}:** ${(metadata?.generatedAt ?? new Date().toISOString()).split('T')[0]}  `);
  lines.push('');

  lines.push(`## ${labels.requirement}`);
  lines.push('');
  lines.push(`> ${analysis.requirementRevision.rawText.split('\n').join('\n> ')}`);
  lines.push('');

  if (metadata) {
    lines.push(`## ${labels.provenance}`);
    lines.push('');
    lines.push(`- ${labels.analysisId}: \`${metadata.analysisId}\``);
    lines.push(`- ${labels.generatedDocumentId}: \`${metadata.generatedDocumentId}\``);
    lines.push(`- ${labels.projectId}: \`${metadata.projectId}\``);
    lines.push(`- ${labels.repositoryId}: \`${metadata.repositoryId}\``);
    lines.push(`- ${labels.snapshotId}: \`${metadata.snapshotId}\``);
    lines.push(`- ${labels.targetRef}: \`${metadata.targetRef}\``);
    lines.push(`- ${labels.commitSha}: \`${metadata.commitSha}\``);
    lines.push(`- ${labels.analyzerVersion}: \`${metadata.analyzerVersion}\``);
    lines.push(`- ${labels.finalizedAt}: ${metadata.finalizedAt ?? metadata.generatedAt}`);
    const domainPack = readObjectField(analysis.metadata, 'domainPack');
    const domainPackId = readStringField(domainPack, 'id');
    const domainPackVersion = readStringField(domainPack, 'version');
    const domainPackStatus = readStringField(domainPack, 'status');
    const domainPackSelectedBy = readStringField(domainPack, 'selectedBy');
    if (domainPackId && domainPackVersion && domainPackStatus && domainPackSelectedBy) {
      lines.push(`- ${labels.domainPack}: \`${domainPackId}@${domainPackVersion}\` (${domainPackStatus}, ${domainPackSelectedBy})`);
    }
    lines.push('');
  }

  if (readStringField(readObjectField(analysis.metadata, 'domainPack'), 'status') === 'PARTIAL') {
    lines.push(`> **${labels.domainPack}: PARTIAL.** ${labels.partialDomainPackWarning} ${labels.administrativeWorkflowOnly} ${labels.noMedicalClinicalCompliance}`);
    lines.push('');
  }

  const terminology = getDomainTerminology(resolveDomainPackId(analysis), context.locale);
  if (context.locale === 'vi' && terminology.length > 0) {
    lines.push(`## ${labels.terminology}`);
    lines.push('');
    for (const term of terminology) {
      lines.push(`- ${term.key}: ${term.value}`);
    }
    lines.push('');
  }

  const diagnostics = (analysis.snapshot.diagnostics as any as any[]) || [];
  const capabilitySummary = diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
  const unsupportedDiagnostics = diagnostics.filter(d => 
    d.code !== 'SCANNER_CAPABILITY_SUMMARY' && 
    (d.code.includes('UNSUPPORTED') || d.severity === 'WARN' || d.severity === 'ERROR')
  );

  if (capabilitySummary?.payload) {
    lines.push(`## ${labels.scannerCapabilityProfile}`);
    lines.push('');
    const p = capabilitySummary.payload;
    lines.push(`- **${labels.language}:** ${p.language}`);
    if (p.framework) lines.push(`- **${labels.framework}:** ${p.framework}`);
    lines.push(`- **${labels.maturityStatus}:** ${p.status}`);
    lines.push(`- **${labels.confidenceLevel}:** ${p.confidence}`);
    lines.push('');
  }

  if (unsupportedDiagnostics.length > 0) {
    lines.push(`## ${labels.scannerDiagnosticsAndRisks}`);
    lines.push('');
    for (const diag of unsupportedDiagnostics) {
      lines.push(`- **${diag.code}**: ${diag.message}`);
    }
    lines.push('');
  }

  return lines;
}

function resolveDomainPackId(analysis: MarkdownReportRenderContext['analysis']) {
  const domainPack = readObjectField(analysis.metadata, 'domainPack');
  const id = readStringField(domainPack, 'id');
  return id ?? analysis.snapshot.profile?.domain ?? null;
}

function readObjectField(source: unknown, key: string): Record<string, unknown> | null {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }
  const value = (source as Record<string, unknown>)[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readStringField(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  return typeof value === 'string' ? value : null;
}
