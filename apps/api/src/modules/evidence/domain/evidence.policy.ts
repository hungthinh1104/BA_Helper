import { AppError } from '../../../shared/app-error';

export const EvidencePolicy = {
  validateEvidenceOrigin: (evidence: {
    sourceType: string;
    snapshotId?: string | null;
    artifactId?: string | null;
    requirementRevisionId?: string | null;
  }) => {
    if (evidence.sourceType === 'CODE' || evidence.sourceType === 'STATIC_ANALYSIS' || evidence.sourceType === 'COVERAGE' || evidence.sourceType === 'TEST') {
      if (!evidence.snapshotId) {
        throw new AppError(
          'INVALID_EVIDENCE_ORIGIN',
          'Code-related evidence must link to a snapshotId.',
        );
      }
    }
    
    if (evidence.sourceType === 'REQUIREMENT_INPUT') {
      if (!evidence.requirementRevisionId) {
        throw new AppError(
          'INVALID_EVIDENCE_ORIGIN',
          'Requirement-related evidence must link to a requirementRevisionId.',
        );
      }
    }
  },
  
  redactSecrets: (excerpt: string): { redactedExcerpt: string; hasSecrets: boolean } => {
    const secretRegex = /(?:api[_-]?key|password|secret|token|credentials)[\s:=]+["'][a-zA-Z0-9_\-\.]+["']/gi;
    let hasSecrets = false;
    const redactedExcerpt = excerpt.replace(secretRegex, (match) => {
      hasSecrets = true;
      return match.replace(/["'][a-zA-Z0-9_\-\.]+["']/, '"[REDACTED]"');
    });
    return { redactedExcerpt, hasSecrets };
  },
};
