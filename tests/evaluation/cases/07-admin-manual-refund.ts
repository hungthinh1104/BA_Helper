import { EvaluationCase } from '../evaluation-types';

export const case07: EvaluationCase = {
  id: 'admin-manual-refund',
  requirementTitle: 'Admin manual refund flow',
  requirementText: 'Admins need a dedicated endpoint to manually trigger a refund for any booking regardless of state.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['api:admin.controller.refund', 'service:payment.service.refund'],
    negativeArtifactKeys: ['api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371'],
    evidenceHints: ['admin', 'manual override'],
    unknownsOrQuestions: ['does manual refund bypass partial refund rules'],
    qaScenarios: ['admin refunding completed booking succeeds'],
  }
};
