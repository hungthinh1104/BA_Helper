import { EvaluationCase } from '../evaluation-types';

export const case06: EvaluationCase = {
  id: 'require-cancel-reason',
  requirementTitle: 'Require cancellation reason payload',
  requirementText: 'The cancel booking endpoint must now accept a mandatory reason string from the user.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', 'dto:cancel-booking.dto'],
    negativeArtifactKeys: ['service:payment.service.refund'],
    evidenceHints: ['reason', 'IsNotEmpty'],
    qaScenarios: ['missing reason returns 400 bad request'],
  }
};
