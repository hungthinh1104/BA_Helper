import { EvaluationCase } from '../evaluation-types';

export const case08: EvaluationCase = {
  id: 'payment-callback-retry',
  requirementTitle: 'Payment callback retry idempotency',
  requirementText: 'If the payment gateway sends the payment success webhook multiple times, do not duplicate the booking state transition to PAID.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['api:webhook.controller.handle', 'service:booking.service.markPaid'],
    negativeArtifactKeys: ['service:booking.service.cancel'],
    evidenceHints: ['status === PAID', 'already processed'],
    risks: ['concurrent webhook deliveries causing race conditions'],
    qaScenarios: ['receive webhook twice yields one state change'],
  },
  domain: {
    packId: 'booking',
    expectedConceptKeys: ['payment', 'booking']
  }
};
