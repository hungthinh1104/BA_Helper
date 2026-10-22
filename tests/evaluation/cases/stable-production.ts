import type { EvaluationCase } from '../evaluation-types';

/**
 * Production-path stable evaluation cases.
 *
 * Ground truth is derived from the pinned fixtures' real code and calibrated
 * against the actual runtime pipeline (scan → retrieval → impact orchestration →
 * deterministic fake AI). Two layers are graded:
 *   - criticalArtifactKeys / impactedArtifactKeys → recall on the retrieval net.
 *   - negativeArtifactKeys → must never enter the committed (evidenced-claim) set.
 *
 * `criticalArtifactKeys` are the artifacts the pipeline must ALWAYS surface
 * (per-case recall floor = 1.0). `impactedArtifactKeys` is the fuller, genuinely
 * impacted set graded at the aggregate overall-recall floor.
 */

const BOOKING = 'nestjs-booking-with-payment';
const ORDER = 'nestjs-order-inventory';
const BOOKING_NEGATIVE = 'service-method:src%2Fadmin%2Frefund-report.service.ts#AdminRefundReportService.generateReport~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';

export const productionStableEvaluationCases: EvaluationCase[] = [
  {
    id: 'prod-booking-cancel-refund-slot',
    requirementTitle: 'Cancel paid booking through payment refund',
    requirementText:
      'When a user cancels a paid booking, the cancellation flow must call payment refund and release the slot.',
    targetFixture: BOOKING,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fslot%2Fslot.service.ts#SlotService.releaseSlot~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fslot%2Fslot.service.ts#SlotService.releaseSlot~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Fpayment%2Fpayment.entity.ts#PaymentTransaction',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'REFUNDED' },
        { artifactKey: 'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'cancel' },
      ],
    },
    domain: { packId: 'booking', expectedConceptKeys: ['booking', 'payment', 'refund', 'cancellation'] },
  },
  {
    id: 'prod-booking-double-refund',
    requirementTitle: 'Prevent double refund on repeated cancellation',
    requirementText:
      'Repeated cancellation for the same booking must not create a double refund or duplicate payment transaction.',
    targetFixture: BOOKING,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Fpayment%2Fpayment.entity.ts#PaymentTransaction',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'REFUNDED' },
      ],
    },
    domain: { packId: 'booking', expectedConceptKeys: ['booking', 'payment', 'refund'] },
  },
  {
    id: 'prod-booking-slot-release',
    requirementTitle: 'Release slot after booking cancellation',
    requirementText:
      'After a booking cancellation succeeds, release the slot so it can be rebooked.',
    targetFixture: BOOKING,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fslot%2Fslot.service.ts#SlotService.releaseSlot~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fslot%2Fslot.service.ts#SlotService.releaseSlot~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fslot%2Fslot.service.ts#SlotService.releaseSlot~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'releaseSlot' },
      ],
    },
    domain: { packId: 'booking', expectedConceptKeys: ['booking', 'cancellation'] },
  },
  {
    id: 'prod-booking-payment-state',
    requirementTitle: 'Mark payment refunded after cancellation',
    requirementText:
      'When a booking refund is processed, the payment transaction state must move from PAID to REFUNDED.',
    targetFixture: BOOKING,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Fpayment%2Fpayment.entity.ts#PaymentTransaction',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'REFUNDED' },
      ],
    },
    domain: { packId: 'booking', expectedConceptKeys: ['booking', 'payment', 'refund'] },
  },
  {
    id: 'prod-order-cancel-release',
    requirementTitle: 'Cancel order and release reserved inventory',
    requirementText:
      'When an order is cancelled the system must call order cancellation and release the reserved inventory stock.',
    targetFixture: ORDER,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Forder%2Forder.service.ts#OrderService.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Forder%2Forder.service.ts#OrderService.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Forder%2Forder.entity.ts#Order',
      ],
      negativeArtifactKeys: [
        'service-method:src%2Forder%2Forder.service.ts#OrderService.shipOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'api:src%2Forder%2Forder.controller.ts#OrderController.shipOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      requiredEvidenceAnchors: [
        { artifactKey: 'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'cancel' },
      ],
    },
    domain: { packId: 'ecommerce', expectedConceptKeys: ['order', 'inventory', 'cancellation'] },
  },
  {
    id: 'prod-order-idempotent-cancel',
    requirementTitle: 'Idempotent order cancellation',
    requirementText:
      'Cancelling an order that is already cancelled must not release inventory twice or change order state again.',
    targetFixture: ORDER,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Forder%2Forder.service.ts#OrderService.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Forder%2Forder.service.ts#OrderService.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Forder%2Forder.entity.ts#Order',
      ],
      negativeArtifactKeys: [
        'service-method:src%2Forder%2Forder.service.ts#OrderService.shipOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'api:src%2Forder%2Forder.controller.ts#OrderController.shipOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Forder%2Forder.service.ts#OrderService.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'cancel' },
      ],
    },
    domain: { packId: 'ecommerce', expectedConceptKeys: ['order', 'cancellation'] },
  },
  {
    id: 'prod-booking-refund-policy-clarify',
    requirementTitle: 'Clarify refund policy before cancelling a paid booking',
    requirementText:
      'Booking cancellation should confirm the refund amount and refund deadline before payment refund is issued.',
    targetFixture: BOOKING,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'REFUNDED' },
      ],
    },
    domain: { packId: 'booking', expectedConceptKeys: ['booking', 'payment', 'refund', 'cancellation'] },
  },
  {
    id: 'prod-booking-cancel-entrypoint',
    requirementTitle: 'Expose a cancel endpoint for a paid booking',
    requirementText:
      'The system must expose an API route that cancels a paid booking and drives the cancellation service.',
    targetFixture: BOOKING,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'cancel' },
      ],
    },
    domain: { packId: 'booking', expectedConceptKeys: ['booking', 'cancellation'] },
  },
  {
    id: 'prod-order-cancel-status',
    requirementTitle: 'Set order status to cancelled on cancellation',
    requirementText:
      'When an order is cancelled through the cancellation flow, the order status must be updated to CANCELLED.',
    targetFixture: ORDER,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Forder%2Forder.service.ts#OrderService.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Forder%2Forder.service.ts#OrderService.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Forder%2Forder.entity.ts#Order',
      ],
      negativeArtifactKeys: [
        'service-method:src%2Forder%2Forder.service.ts#OrderService.shipOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'api:src%2Forder%2Forder.controller.ts#OrderController.shipOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      requiredEvidenceAnchors: [
        { artifactKey: 'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'cancel' },
      ],
    },
    domain: { packId: 'ecommerce', expectedConceptKeys: ['order', 'cancellation'] },
  },
  {
    id: 'prod-booking-notify-owner',
    requirementTitle: 'Notify owner on booking cancellation',
    requirementText:
      'When a paid booking is cancelled, notifyOwner must inform the booking owner, and the cancellation triggers a payment refund.',
    targetFixture: BOOKING,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fnotification%2Fnotification.service.ts#NotificationService.notifyOwner~dd6f9df3949ebe095ea261fedb8d6afff333b1a449449ef86a9d6bba8b75dcbb',
      ],
      impactedArtifactKeys: [
        'api:src%2Fbooking%2Fbooking.controller.ts#BookingController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fbooking%2Fbooking.service.ts#BookingService.cancelBooking~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fnotification%2Fnotification.service.ts#NotificationService.notifyOwner~dd6f9df3949ebe095ea261fedb8d6afff333b1a449449ef86a9d6bba8b75dcbb',
        'entity:src%2Fpayment%2Fpayment.entity.ts#PaymentTransaction',
      ],
      // refund-report is retrieved (layer 1) but must never be committed.
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fnotification%2Fnotification.service.ts#NotificationService.notifyOwner~dd6f9df3949ebe095ea261fedb8d6afff333b1a449449ef86a9d6bba8b75dcbb', contains: 'notifyOwner' },
        { artifactKey: 'service-method:src%2Fpayment%2Fpayment.service.ts#PaymentService.refund~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'REFUNDED' },
      ],
    },
    domain: { packId: 'booking', expectedConceptKeys: ['booking', 'cancellation', 'notification', 'refund'] },
  },
  {
    id: 'prod-order-release-inventory',
    requirementTitle: 'Release reserved inventory on cancellation',
    requirementText:
      'Cancelling an order must call releaseReservation to release the reserved inventory stock for the cancelled order.',
    targetFixture: ORDER,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Finventory%2Finventory.service.ts#InventoryService.releaseReservation~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Forder%2Forder.service.ts#OrderService.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Finventory%2Finventory.service.ts#InventoryService.releaseReservation~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Forder%2Forder.entity.ts#Order',
      ],
      // shipOrder (controller + service) is retrieved but must never be committed.
      negativeArtifactKeys: [
        'service-method:src%2Forder%2Forder.service.ts#OrderService.shipOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'api:src%2Forder%2Forder.controller.ts#OrderController.shipOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Finventory%2Finventory.service.ts#InventoryService.releaseReservation~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'releaseReservation' },
        { artifactKey: 'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'cancel' },
      ],
    },
    domain: { packId: 'ecommerce', expectedConceptKeys: ['order', 'inventory', 'cancellation'] },
  },
];
