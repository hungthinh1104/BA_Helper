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
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fslot%2Fslot.service.ts#SlotService.releaseSlot~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fnotification%2Fnotification.service.ts#NotificationService.notifyOwner~dd6f9df3949ebe095ea261fedb8d6afff333b1a449449ef86a9d6bba8b75dcbb',
      ],
      negativeArtifactKeys: ['service-method:src%2Fadmin%2Frefund-report.service.ts#AdminRefundReportService.generateReport~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
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
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Fpayment%2Fpayment.entity.ts#PaymentTransaction',
      ],
      negativeArtifactKeys: ['service-method:src%2Fadmin%2Frefund-report.service.ts#AdminRefundReportService.generateReport~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
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
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fslot%2Fslot.service.ts#SlotService.releaseSlot~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      negativeArtifactKeys: ['service-method:src%2Fadmin%2Frefund-report.service.ts#AdminRefundReportService.generateReport~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
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
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Fpayment%2Fpayment.entity.ts#PaymentTransaction',
      ],
      negativeArtifactKeys: ['service-method:src%2Fadmin%2Frefund-report.service.ts#AdminRefundReportService.generateReport~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
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
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      negativeArtifactKeys: ['service-method:src%2Fadmin%2Frefund-report.service.ts#AdminRefundReportService.generateReport~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
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
