import { MarkdownReportRenderContext } from '../../markdown-impact-report.types';
import { formatCertainty } from './markdown-render-utils';
import { getReportLabels } from '../report-localization';

export function renderImpactsAndAc(context: MarkdownReportRenderContext): string[] {
  const { insights, reviewNotes } = context;
  const labels = getReportLabels(context.locale);
  const lines: string[] = [];

  const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
  const claims = approvedInsights.filter(i => i.insightType === 'CLAIM');
  const acceptanceCriteria = approvedInsights.filter(i => i.insightType === 'ACCEPTANCE_CRITERIA');

  if (claims.length > 0) {
    lines.push(`## ${labels.evidenceBackedImpacts}`);
    lines.push('');
    claims.forEach((claim, index) => {
      lines.push(`### ${index + 1}. ${claim.description || claim.title}`);
      lines.push('');
      lines.push(`**${labels.certainty}:** ${formatCertainty(claim.certainty, context.locale)}  `);
      const claimNote = reviewNotes.find(n => n.insightId === claim.id);
      if (claimNote) {
        lines.push(`**${labels.reviewerNote}:** ${claimNote.body}  `);
      }
      if (claim.reasoning) {
        lines.push(`**${labels.reasoning}:** ${claim.reasoning}  `);
      }
      lines.push('');
      
      if (claim.evidenceLinks.length > 0) {
        lines.push(`**${labels.evidence}:**`);
        const filePaths = new Set(claim.evidenceLinks.map(e => e.evidence.sourcePath).filter(Boolean));
        filePaths.forEach(path => lines.push(`- \`${path}\``));
      } else {
        lines.push(labels.noEvidenceAttached);
      }
      lines.push('');
    });
  }

  if (acceptanceCriteria.length > 0) {
    lines.push(`## ${labels.acceptanceCriteria}`);
    lines.push('');
    for (const ac of acceptanceCriteria) {
      lines.push(`- ${ac.description || ac.title}`);
      const acNote = reviewNotes.find(n => n.insightId === ac.id);
      if (acNote) {
        lines.push(`  <br/>**${labels.reviewerNote}:** ${acNote.body}`);
      }
      if (ac.evidenceLinks.length === 0) {
        lines.push(`  <br/>${labels.notDirectlyEvidenced}`);
      }
    }
    lines.push('');
  }

  return lines;
}

export function renderQuestionsAndClarifications(context: MarkdownReportRenderContext): string[] {
  const { insights, reviewNotes, clarifications } = context;
  const labels = getReportLabels(context.locale);
  const lines: string[] = [];

  const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
  const openQuestions = approvedInsights.filter(i => i.insightType === 'QUESTION' || i.insightType === 'UNKNOWN');

  if (openQuestions.length > 0) {
    lines.push(`## ${labels.openQuestions}`);
    lines.push('');
    for (const q of openQuestions) {
      lines.push(`### ${q.title}`);
      lines.push('');
      lines.push(`**${labels.question}:** ${q.description || q.title}`);
      lines.push('');
      const qNote = reviewNotes.find(n => n.insightId === q.id);
      if (qNote) {
        lines.push(`**${labels.reviewerNote}:** ${qNote.body}`);
        lines.push('');
      }
      if (q.reasoning) {
        lines.push(`**${labels.whyThisMatters}:** ${q.reasoning}`);
        lines.push('');
      }
      
      if (q.metadata && typeof q.metadata === 'object' && (q.metadata as any).origin === 'SCANNER_DIAGNOSTIC') {
        lines.push(labels.derivedFromScannerDiagnostic);
        lines.push('');
      }
    }
  }

  if (clarifications.length > 0) {
    lines.push(`## ${labels.clarifications}`);
    lines.push('');

    const answered = clarifications.filter(c => c.status === 'ANSWERED' || c.status === 'CONVERTED_TO_REVISION');
    const open = clarifications.filter(c => c.status === 'OPEN');
    const dismissed = clarifications.filter(c => c.status === 'DISMISSED');

    if (answered.length > 0) {
      lines.push(`### ${labels.answered}`);
      lines.push('');
      answered.forEach(c => {
        lines.push(`**${labels.question}:** ${c.question}  `);
        if (c.reason) lines.push(`**${labels.whyThisMatters}:** ${c.reason}  `);
        lines.push(`**${labels.answer}:** ${c.answer}  `);
        if (c.status === 'CONVERTED_TO_REVISION' && c.convertedRequirementRevisionId) {
          lines.push(`**${labels.disposition}:** ${labels.convertedToRequirementRevision} \`${c.convertedRequirementRevisionId}\``);
        }
        lines.push('');
      });
    }

    if (open.length > 0) {
      lines.push(`### ${labels.stillOpen}`);
      lines.push('');
      open.forEach(c => {
        lines.push(`**${labels.question}:** ${c.question}  `);
        if (c.reason) lines.push(`**${labels.whyThisMatters}:** ${c.reason}  `);
        lines.push('');
      });
    }

    if (dismissed.length > 0) {
      lines.push(`### ${labels.dismissed}`);
      lines.push('');
      dismissed.forEach(c => {
        lines.push(`**${labels.question}:** ${c.question}  `);
        lines.push(`**${labels.disposition}:** ${labels.dismissedDuringReview} ${c.reason ? `${labels.reason}: ${c.reason}` : ''}`);
        lines.push('');
      });
    }
  }

  return lines;
}
