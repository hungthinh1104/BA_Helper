import { AppError } from '@ba-helper/shared';

export const InsightPolicy = {
  validateInsight: (insight: { certainty: string; evidenceCount: number }) => {
    if (insight.certainty === 'EVIDENCED' && insight.evidenceCount === 0) {
      throw new AppError(
        'INVALID_INSIGHT_CERTAINTY',
        'An EVIDENCED insight must link to at least one persisted Evidence record.',
      );
    }
  },
};
