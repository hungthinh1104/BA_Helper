import { EvaluationCase } from '../evaluation-types';

export const case07: EvaluationCase = {
  id: 'admin-manual-refund',
  requirementTitle: 'Admin manual refund flow',
  requirementText: 'Admins need a dedicated endpoint to manually trigger a refund for any booking regardless of state.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['api:admin.controller.refund', 'service:payment.service.refund'],
    negativeArtifactKeys: ['api:booking.controller.cancel'],
    evidenceHints: ['admin', 'manual override'],
    unknownsOrQuestions: ['does manual refund bypass partial refund rules'],
    qaScenarios: ['admin refunding completed booking succeeds'],
  }
};
