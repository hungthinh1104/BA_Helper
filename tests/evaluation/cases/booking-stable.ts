import { EvaluationCase } from '../evaluation-types';

export const bookingStableEvaluationCases: EvaluationCase[] = [
  {
    id: 'booking-stable-cancel-refund-flow',
    requirementTitle: 'Cancel booking through payment refund flow',
    requirementText:
      'When a user cancels a paid booking, the cancellation flow must call payment refund, release the slot, and send a notification to the owner.',
    targetFixture: 'nestjs-booking-with-payment',
    expected: {
      impactedArtifactKeys: [
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
        'service-method:slot.service.releaseSlot',
        'service-method:notification.service.notifyOwner',
      ],
      negativeArtifactKeys: ['service-method:refund-report.service.generateReport'],
      evidenceHints: ['cancelBooking', 'PaymentService.refund', 'releaseSlot', 'notifyOwner'],
      unknownsOrQuestions: ['refund percentage', 'who may cancel', 'slot re-open policy'],
      risks: ['duplicate refund', 'payment gateway failure'],
      qaScenarios: ['cancel paid booking triggers exactly one refund and slot release'],
    },
    domain: {
      packId: 'booking',
      expectedConceptKeys: ['booking', 'payment', 'refund', 'cancellation', 'notification'],
    },
  },
  {
    id: 'booking-stable-double-refund-policy',
    requirementTitle: 'Prevent double refund during booking cancellation',
    requirementText:
      'Repeated cancellation for the same booking must not create a double refund or duplicate payment refund request.',
    targetFixture: 'nestjs-booking-with-payment',
    expected: {
      impactedArtifactKeys: [
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
        'entity:paymenttransaction',
      ],
      negativeArtifactKeys: ['service-method:refund-report.service.generateReport'],
      evidenceHints: ['refund', 'PaymentTransaction', 'PaymentStatus.REFUNDED'],
      unknownsOrQuestions: ['idempotency key', 'existing refund record', 'concurrent cancellation'],
      risks: ['duplicate refund', 'race condition between repeated cancellation requests'],
      qaScenarios: ['submit the same cancellation twice and verify only one refund is created'],
    },
    domain: {
      packId: 'booking',
      expectedConceptKeys: ['booking', 'payment', 'refund', 'cancellation'],
    },
  },
  {
    id: 'booking-stable-inventory-release',
    requirementTitle: 'Release slot inventory after booking cancellation',
    requirementText:
      'After booking cancellation succeeds, release the slot inventory so the booked slot can be considered for rebooking.',
    targetFixture: 'nestjs-booking-with-payment',
    expected: {
      impactedArtifactKeys: [
        'service-method:booking.service.cancelBooking',
        'service-method:slot.service.releaseSlot',
      ],
      negativeArtifactKeys: ['service-method:refund-report.service.generateReport'],
      evidenceHints: ['releaseSlot', 'slotId'],
      unknownsOrQuestions: ['when the released slot becomes bookable again'],
      risks: ['slot reopened before refund state is settled'],
      qaScenarios: ['cancel paid booking and verify inventory release is invoked once'],
    },
    domain: {
      packId: 'booking',
      expectedConceptKeys: ['booking', 'cancellation'],
    },
  },
  {
    id: 'booking-stable-payment-state',
    requirementTitle: 'Mark payment state as refunded after cancellation',
    requirementText:
      'When a booking refund is processed, the payment transaction state must move from PAID to REFUNDED.',
    targetFixture: 'nestjs-booking-with-payment',
    expected: {
      impactedArtifactKeys: [
        'service-method:payment.service.refund',
        'entity:paymenttransaction',
      ],
      negativeArtifactKeys: ['service-method:refund-report.service.generateReport'],
      evidenceHints: ['PaymentStatus.PAID', 'PaymentStatus.REFUNDED'],
      unknownsOrQuestions: ['refund failure rollback behavior'],
      risks: ['payment state mismatch after refund failure'],
      qaScenarios: ['refund paid booking and assert payment state is REFUNDED'],
    },
    domain: {
      packId: 'booking',
      expectedConceptKeys: ['booking', 'payment', 'refund'],
    },
  },
  {
    id: 'booking-stable-policy-hints-stay-unknown',
    requirementTitle: 'Clarify refund deadline for cancelled booking',
    requirementText:
      'Booking cancellation should explain whether refund deadline, refund amount, and owner approval are required before payment refund.',
    targetFixture: 'nestjs-booking-with-payment',
    expected: {
      impactedArtifactKeys: [
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
      ],
      negativeArtifactKeys: ['service-method:refund-report.service.generateReport'],
      evidenceHints: ['cancelBooking', 'refund'],
      unknownsOrQuestions: ['refund deadline', 'refund amount', 'owner approval'],
      risks: ['domain pack hint presented as existing refund policy'],
      qaScenarios: ['reviewer confirms refund deadline before final acceptance criteria are approved'],
    },
    domain: {
      packId: 'booking',
      expectedConceptKeys: ['booking', 'payment', 'refund', 'cancellation'],
    },
  },
];
