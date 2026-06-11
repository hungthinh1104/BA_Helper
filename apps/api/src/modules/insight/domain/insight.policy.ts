import { AppError } from '../../../shared/app-error';

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
