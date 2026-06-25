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
        'service-method:booking.service.cancelBooking',
        'entity:booking',
      ],
      negativeArtifactKeys: ['service-method:refund-report.service.generateReport'],
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
        'service-method:payment.service.refund',
        'entity:paymenttransaction',
      ],
      negativeArtifactKeys: ['service-method:refund-report.service.generateReport'],
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
        'service-method:booking.service.cancelBooking',
        'service-method:slot.service.releaseSlot',
      ],
      negativeArtifactKeys: ['service-method:refund-report.service.generateReport'],
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
        'service-method:booking.service.cancelBooking',
        'service-method:notification.service.notifyOwner',
      ],
      negativeArtifactKeys: ['service-method:refund-report.service.generateReport'],
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
