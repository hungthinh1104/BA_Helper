import { traceabilityReviewInvalidationKeys } from './use-insights';

describe('traceabilityReviewInvalidationKeys', () => {
  it('invalidates detail, traceability, review queue, list, and approved report queries', () => {
    expect(
      traceabilityReviewInvalidationKeys('project-1', 'analysis-1'),
    ).toEqual([
      ['impact-analyses', 'detail', 'analysis-1', 'traceability'],
      ['impact-analyses', 'review-queue', 'analysis-1'],
      ['impact-analyses', 'detail', 'analysis-1'],
      ['impact-analyses', 'list', 'project-1', undefined],
      ['impact-analyses', 'approved-report', 'analysis-1'],
    ]);
  });
});
