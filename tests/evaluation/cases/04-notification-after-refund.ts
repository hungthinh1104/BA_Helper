import { EvaluationCase } from '../evaluation-types';

export const case04: EvaluationCase = {
  id: 'notification-after-refund',
  requirementTitle: 'Notification after refund completion',
  requirementText: 'Send an email notification to the user after their refund is successfully processed.',
  targetFixture: 'nestjs-booking-with-payment',
  expected: {
    impactedArtifactKeys: ['service:payment.service.refund', 'service:notification.service.send'],
    negativeArtifactKeys: ['api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371'],
    evidenceHints: ['email', 'sendNotification'],
    qaScenarios: ['refund success sends email', 'refund failure does not send email'],
  }
};
