import { impactAnalysisAiSchema } from './ai.schema';

const insight = {
  insightKey: 'claim:cancel-refund',
  insightType: 'CLAIM',
  certainty: 'EVIDENCED',
  confidence: 0.5,
  title: 'Cancellation triggers a refund.',
  description: 'The cancellation flow requests a refund.',
};

describe('impactAnalysisAiSchema confidence', () => {
  it.each([null, 0, 1])('accepts valid confidence %s', (confidence) => {
    expect(impactAnalysisAiSchema.safeParse({
      insights: [{ ...insight, confidence }],
    }).success).toBe(true);
  });

  it.each([-0.01, 1.01])('rejects confidence outside [0, 1]: %s', (confidence) => {
    expect(impactAnalysisAiSchema.safeParse({
      insights: [{ ...insight, confidence }],
    }).success).toBe(false);
  });
});
