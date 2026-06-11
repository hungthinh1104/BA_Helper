import { EvaluationCase } from '../evaluation-types';

export const case02: EvaluationCase = {
  id: 'prevent-double-refund',
  requirementTitle: 'Prevent double refund on repeated cancellation',
  requirementText: 'Ensure that if a cancellation request is submitted multiple times, the refund is only processed once.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['service:payment.service.refund'],
    negativeArtifactKeys: ['api:booking.controller.get'],
    evidenceHints: ['idempotency', 'already refunded'],
    risks: ['race condition in refund processing'],
    qaScenarios: ['submit cancel twice yields one refund'],
  }
};
