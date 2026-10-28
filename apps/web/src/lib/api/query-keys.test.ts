import { queryKeys } from './query-keys';

describe('final-reviewed report cache identity', () => {
  it('is shared across the report page and final-reviewed dialog and invalidated with the approved report prefix', () => {
    const analysisId = 'analysis-1';
    const prefix = queryKeys.analyses.report(analysisId);
    expect(queryKeys.documents.finalReviewedReport(analysisId, 'en'))
      .toEqual([...prefix, 'final-reviewed', 'en']);
    expect(queryKeys.documents.finalReviewedReport(analysisId, 'vi-VN'))
      .toEqual([...prefix, 'final-reviewed', 'vi-VN']);
    expect(queryKeys.documents.finalReviewedReport(analysisId, 'en'))
      .toEqual(queryKeys.documents.finalReviewedReport(analysisId));
    expect(queryKeys.documents.finalReviewedReport('analysis-2', 'en'))
      .not.toEqual(queryKeys.documents.finalReviewedReport(analysisId, 'en'));
  });
});
