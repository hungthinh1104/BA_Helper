import { submitReviewItemDecisionRequestSchema } from './src';

describe('review decision request contract', () => {
  it('requires a stable UUID request key for each review command', () => {
    const request = {
      target: 'impact',
      action: 'accept',
      rationale: 'Evidence reviewed.',
      requestKey: 'b28917b1-07d8-4941-8735-38626b5da8e7',
    };

    expect(submitReviewItemDecisionRequestSchema.parse(request)).toEqual(request);
    expect(() => submitReviewItemDecisionRequestSchema.parse({
      target: 'impact',
      action: 'accept',
    })).toThrow();
  });
});
