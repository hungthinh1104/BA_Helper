import { EvaluationCase } from '../evaluation-types';

export const case03: EvaluationCase = {
  id: 'partial-refund-within-24h',
  requirementTitle: 'Partial refund policy within 24 hours',
  requirementText: 'If cancellation occurs within 24 hours of the booking start time, only issue a 50% partial refund.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['service:booking.service.cancel', 'service:payment.service.refund'],
    negativeArtifactKeys: [],
    evidenceHints: ['50%', '24 hours'],
    unknownsOrQuestions: ['timezone for 24 hours check'],
    qaScenarios: ['cancel at 23 hours gets 50%', 'cancel at 25 hours gets 100%'],
  },
  domain: {
    packId: 'booking',
    expectedConceptKeys: ['refund', 'cancellation']
  }
};
