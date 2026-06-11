import { EvaluationCase } from '../evaluation-types';

export const case01: EvaluationCase = {
  id: 'cancel-paid-booking-refund',
  requirementTitle: 'Cancel paid booking and issue refund',
  requirementText: 'When a user cancels a paid booking, the system must trigger a refund for the full amount.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['api:booking.controller.cancel', 'service:payment.service.refund'],
    negativeArtifactKeys: ['api:booking.controller.create'],
    evidenceHints: ['refund', 'cancel'],
    unknownsOrQuestions: ['how long does the refund take'],
    qaScenarios: ['cancel paid booking triggers refund', 'cancel unpaid booking does not trigger refund'],
  },
  domain: {
    packId: 'booking',
    expectedConceptKeys: ['refund', 'payment', 'cancellation']
  }
};
