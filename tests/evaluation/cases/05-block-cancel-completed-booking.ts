import { EvaluationCase } from '../evaluation-types';

export const case05: EvaluationCase = {
  id: 'block-cancel-completed-booking',
  requirementTitle: 'Block cancellation after completed booking',
  requirementText: 'A booking that has already been marked as COMPLETED cannot be cancelled.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['service:booking.service.cancel'],
    negativeArtifactKeys: ['service:payment.service.refund'],
    evidenceHints: ['status === COMPLETED'],
    qaScenarios: ['completed booking throws error on cancel'],
  }
};
