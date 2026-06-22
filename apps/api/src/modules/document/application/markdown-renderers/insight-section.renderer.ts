import { MarkdownReportRenderContext } from '../markdown-impact-report.types';
import { formatCertainty } from './markdown-render-utils';

export function renderImpactsAndAc(context: MarkdownReportRenderContext): string[] {
  const { insights, reviewNotes } = context;
  const lines: string[] = [];

  const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
  const claims = approvedInsights.filter(i => i.insightType === 'CLAIM');
  const acceptanceCriteria = approvedInsights.filter(i => i.insightType === 'ACCEPTANCE_CRITERIA');

  if (claims.length > 0) {
    lines.push('## Evidence-backed Impacts');
    lines.push('');
    claims.forEach((claim, index) => {
      lines.push(`### ${index + 1}. ${claim.description || claim.title}`);
      lines.push('');
      lines.push(`**Certainty:** ${formatCertainty(claim.certainty)}  `);
      const claimNote = reviewNotes.find(n => n.insightId === claim.id);
      if (claimNote) {
        lines.push(`**Reviewer Note:** ${claimNote.body}  `);
      }
      if (claim.reasoning) {
        lines.push(`**Reasoning:** ${claim.reasoning}  `);
      }
      lines.push('');
      
      if (claim.evidenceLinks.length > 0) {
        lines.push('**Evidence:**');
        const filePaths = new Set(claim.evidenceLinks.map(e => e.evidence.sourcePath).filter(Boolean));
        filePaths.forEach(path => lines.push(`- \`${path}\``));
      } else {
        lines.push('_No evidence attached._');
      }
      lines.push('');
    });
  }

  if (acceptanceCriteria.length > 0) {
    lines.push('## Acceptance Criteria');
    lines.push('');
    for (const ac of acceptanceCriteria) {
      lines.push(`- ${ac.description || ac.title}`);
      const acNote = reviewNotes.find(n => n.insightId === ac.id);
      if (acNote) {
        lines.push(`  <br/>**Reviewer Note:** ${acNote.body}`);
      }
      if (ac.evidenceLinks.length === 0) {
        lines.push(`  <br/>_Not directly evidenced; derived from requirement and should be confirmed._`);
      }
    }
    lines.push('');
  }

  return lines;
}

export function renderQuestionsAndClarifications(context: MarkdownReportRenderContext): string[] {
  const { insights, reviewNotes, clarifications } = context;
  const lines: string[] = [];

  const approvedInsights = insights.filter((i) => i.reviewStatus !== 'REJECTED');
  const openQuestions = approvedInsights.filter(i => i.insightType === 'QUESTION' || i.insightType === 'UNKNOWN');

  if (openQuestions.length > 0) {
    lines.push('## Open Questions / Unknowns');
    lines.push('');
    for (const q of openQuestions) {
      lines.push(`### ${q.title}`);
      lines.push('');
      lines.push(`**Question:** ${q.description || q.title}`);
      lines.push('');
      const qNote = reviewNotes.find(n => n.insightId === q.id);
      if (qNote) {
        lines.push(`**Reviewer Note:** ${qNote.body}`);
        lines.push('');
      }
      if (q.reasoning) {
        lines.push(`**Why this matters:** ${q.reasoning}`);
        lines.push('');
      }
      
      if (q.metadata && typeof q.metadata === 'object' && (q.metadata as any).origin === 'SCANNER_DIAGNOSTIC') {
        lines.push(`_Derived from scanner diagnostic_`);
        lines.push('');
      }
    }
  }

  if (clarifications.length > 0) {
    lines.push('## Clarifications');
    lines.push('');

    const answered = clarifications.filter(c => c.status === 'ANSWERED' || c.status === 'CONVERTED_TO_REVISION');
    const open = clarifications.filter(c => c.status === 'OPEN');
    const dismissed = clarifications.filter(c => c.status === 'DISMISSED');

    if (answered.length > 0) {
      lines.push('### Answered');
      lines.push('');
      answered.forEach(c => {
        lines.push(`**Question:** ${c.question}  `);
        if (c.reason) lines.push(`**Why this matters:** ${c.reason}  `);
        lines.push(`**Answer:** ${c.answer}  `);
        if (c.status === 'CONVERTED_TO_REVISION' && c.convertedRequirementRevisionId) {
          lines.push(`**Disposition:** Converted to Requirement Revision \`${c.convertedRequirementRevisionId}\``);
        }
        lines.push('');
      });
    }

    if (open.length > 0) {
      lines.push('### Still Open');
      lines.push('');
      open.forEach(c => {
        lines.push(`**Question:** ${c.question}  `);
        if (c.reason) lines.push(`**Why this matters:** ${c.reason}  `);
        lines.push('');
      });
    }

    if (dismissed.length > 0) {
      lines.push('### Dismissed');
      lines.push('');
      dismissed.forEach(c => {
        lines.push(`**Question:** ${c.question}  `);
        lines.push(`**Disposition:** Dismissed during review. ${c.reason ? `Reason: ${c.reason}` : ''}`);
        lines.push('');
      });
    }
  }

  return lines;
}
