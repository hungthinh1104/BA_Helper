import { EvaluationCase } from '../evaluation-types';

export const case01: EvaluationCase = {
  id: 'cancel-paid-booking-refund',
  requirementTitle: 'Cancel paid booking and issue refund',
  requirementText: 'When a user cancels a paid booking, the system must trigger a refund for the full amount.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', 'service:payment.service.refund'],
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
