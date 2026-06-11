import { EvaluationCase } from '../evaluation-types';

export const case04: EvaluationCase = {
  id: 'notification-after-refund',
  requirementTitle: 'Notification after refund completion',
  requirementText: 'Send an email notification to the user after their refund is successfully processed.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['service:payment.service.refund', 'service:notification.service.send'],
    negativeArtifactKeys: ['api:booking.controller.cancel'],
    evidenceHints: ['email', 'sendNotification'],
    qaScenarios: ['refund success sends email', 'refund failure does not send email'],
  }
};
