import { EvaluationCase } from '../evaluation-types';

export const case06: EvaluationCase = {
  id: 'require-cancel-reason',
  requirementTitle: 'Require cancellation reason payload',
  requirementText: 'The cancel booking endpoint must now accept a mandatory reason string from the user.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['api:booking.controller.cancel', 'dto:cancel-booking.dto'],
    negativeArtifactKeys: ['service:payment.service.refund'],
    evidenceHints: ['reason', 'IsNotEmpty'],
    qaScenarios: ['missing reason returns 400 bad request'],
  }
};
