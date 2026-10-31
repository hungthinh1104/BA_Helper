import { AiPolicy, AppError } from '@ba-helper/shared';

export const RequirementPolicy = {
  validateRevisionInput: (params: { title: string; rawText: string }) => {
    if (!params.title.trim()) {
      throw new AppError(
        'INVALID_REQUIREMENT_INPUT',
        'Requirement title is required.',
      );
    }

    if (!params.rawText.trim()) {
      throw new AppError(
        'INVALID_REQUIREMENT_INPUT',
        'Requirement text is required.',
      );
    }

    if (AiPolicy.redactPayload(params.rawText).hasSecrets) {
      throw new AppError(
        'INVALID_REQUIREMENT_INPUT',
        'Requirement text contains potential secrets.',
      );
    }
  },
  qualifyReadiness: (rawText: string) => {
    const normalized = rawText.trim().toLowerCase();
    if (normalized.length < 10) {
      return {
        status: 'NEEDS_CLARIFICATION' as const,
        issues: ['Requirement text is too vague.'],
      };
    }
    return { status: 'READY_FOR_ANALYSIS' as const, issues: [] };
  },
  enforceImmutableRevision: () => {
    throw new AppError(
      'IMMUTABLE_REVISION',
      'Requirement revisions are immutable. Create a new revision instead.',
    );
  },
};
