import { EvaluationCase } from '../evaluation-types';

export const generalFallbackEvaluationCases: EvaluationCase[] = [
  {
    id: 'general-fallback-resource-state-change',
    requirementTitle: 'Review resource lifecycle state change',
    requirementText:
      'A resource lifecycle operation changes state and may trigger connected side effects. Identify source-backed artifacts only and keep domain policy gaps uncertain.',
    targetFixture: 'nestjs-booking-with-payment',
    expected: {
      impactedArtifactKeys: [
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Fbooking%2Fbooking.entity.ts#Booking',
      ],
      negativeArtifactKeys: ['service-method:src%2Fadmin%2Frefund-report.service.ts#AdminRefundReportService.generateReport~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
      evidenceHints: ['status', 'connected side effects'],
      unknownsOrQuestions: [
        'unknown: exact lifecycle eligibility requires source evidence or stakeholder confirmation',
      ],
      risks: [
        'inferred risk: state transition side effects may be inconsistent without stronger evidence',
      ],
      qaScenarios: [
        'uncertain qa: verify the concrete source-backed state transition before approval',
      ],
    },
    domain: {
      packId: 'general',
      expectedConceptKeys: [],
    },
  },
  {
    id: 'general-fallback-external-transaction-reversal',
    requirementTitle: 'Review external transaction reversal',
    requirementText:
      'A lifecycle operation may reverse an external transaction after a state change. Use raw source excerpts for evidence and keep policy assumptions uncertain.',
    targetFixture: 'nestjs-booking-with-payment',
    expected: {
      impactedArtifactKeys: [
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Fpayment%2Fpayment.entity.ts#PaymentTransaction',
      ],
      negativeArtifactKeys: ['service-method:src%2Fadmin%2Frefund-report.service.ts#AdminRefundReportService.generateReport~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
      evidenceHints: ['transaction', 'state'],
      unknownsOrQuestions: [
        'unknown: reversal eligibility and amount rules are not established by the fallback profile',
      ],
      risks: [
        'inferred risk: external transaction state can diverge from lifecycle state',
      ],
      qaScenarios: [
        'uncertain qa: verify transaction state changes only against source-backed behavior',
      ],
    },
    domain: {
      packId: 'general',
      expectedConceptKeys: [],
    },
  },
  {
    id: 'general-fallback-inventory-availability-side-effect',
    requirementTitle: 'Review availability side effect',
    requirementText:
      'A resource lifecycle operation may change downstream availability. Treat business timing as unknown unless current source evidence proves it.',
    targetFixture: 'nestjs-booking-with-payment',
    expected: {
      impactedArtifactKeys: [
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fslot%2Fslot.service.ts#SlotService.releaseSlot~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      negativeArtifactKeys: ['service-method:src%2Fadmin%2Frefund-report.service.ts#AdminRefundReportService.generateReport~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
      evidenceHints: ['availability', 'side effect'],
      unknownsOrQuestions: [
        'unknown: downstream availability timing is not proven by fallback metadata',
      ],
      risks: [
        'inferred risk: availability may change before related state is settled',
      ],
      qaScenarios: [
        'uncertain qa: verify availability behavior with source-backed timing evidence',
      ],
    },
    domain: {
      packId: 'general',
      expectedConceptKeys: [],
    },
  },
  {
    id: 'general-fallback-notification-side-effect',
    requirementTitle: 'Review outbound side effect',
    requirementText:
      'A resource lifecycle operation may emit an outbound message. Keep recipient and timing policy uncertain without explicit source evidence.',
    targetFixture: 'nestjs-booking-with-payment',
    expected: {
      impactedArtifactKeys: [
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fnotification%2Fnotification.service.ts#NotificationService.notifyOwner~dd6f9df3949ebe095ea261fedb8d6afff333b1a449449ef86a9d6bba8b75dcbb',
      ],
      negativeArtifactKeys: ['service-method:src%2Fadmin%2Frefund-report.service.ts#AdminRefundReportService.generateReport~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
      evidenceHints: ['outbound message', 'side effect'],
      unknownsOrQuestions: [
        'unknown: recipient and timing policy require source evidence or stakeholder confirmation',
      ],
      risks: [
        'inferred risk: outbound side effect may be emitted at the wrong lifecycle point',
      ],
      qaScenarios: [
        'uncertain qa: verify outbound side effect timing after evidence review',
      ],
    },
    domain: {
      packId: 'general',
      expectedConceptKeys: [],
    },
  },
];
