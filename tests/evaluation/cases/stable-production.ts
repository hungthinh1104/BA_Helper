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
const BOOKING_NEGATIVE = 'service-method:refund-report.service.generateReport';

export const productionStableEvaluationCases: EvaluationCase[] = [
  {
    id: 'prod-booking-cancel-refund-slot',
    requirementTitle: 'Cancel paid booking through payment refund',
    requirementText:
      'When a user cancels a paid booking, the cancellation flow must call payment refund and release the slot.',
    targetFixture: BOOKING,
    expected: {
      criticalArtifactKeys: [
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
        'service-method:slot.service.releaseSlot',
      ],
      impactedArtifactKeys: [
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
        'service-method:slot.service.releaseSlot',
        'entity:paymenttransaction',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:payment.service.refund', contains: 'REFUNDED' },
        { artifactKey: 'api:booking.controller.cancel', contains: 'cancel' },
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
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
      ],
      impactedArtifactKeys: [
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
        'entity:paymenttransaction',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:payment.service.refund', contains: 'REFUNDED' },
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
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:slot.service.releaseSlot',
      ],
      impactedArtifactKeys: [
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:slot.service.releaseSlot',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:slot.service.releaseSlot', contains: 'releaseSlot' },
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
        'api:booking.controller.cancel',
        'service-method:payment.service.refund',
      ],
      impactedArtifactKeys: [
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
        'entity:paymenttransaction',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:payment.service.refund', contains: 'REFUNDED' },
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
        'api:order.controller.cancelOrder',
        'service-method:order.service.cancelOrder',
      ],
      impactedArtifactKeys: [
        'api:order.controller.cancelOrder',
        'service-method:order.service.cancelOrder',
        'entity:order',
      ],
      negativeArtifactKeys: [
        'service-method:order.service.shipOrder',
        'api:order.controller.shipOrder',
      ],
      requiredEvidenceAnchors: [
        { artifactKey: 'api:order.controller.cancelOrder', contains: 'cancel' },
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
        'api:order.controller.cancelOrder',
        'service-method:order.service.cancelOrder',
      ],
      impactedArtifactKeys: [
        'api:order.controller.cancelOrder',
        'service-method:order.service.cancelOrder',
        'entity:order',
      ],
      negativeArtifactKeys: [
        'service-method:order.service.shipOrder',
        'api:order.controller.shipOrder',
      ],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:order.service.cancelOrder', contains: 'cancel' },
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
        'api:booking.controller.cancel',
        'service-method:payment.service.refund',
      ],
      impactedArtifactKeys: [
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:payment.service.refund', contains: 'REFUNDED' },
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
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
      ],
      impactedArtifactKeys: [
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
      ],
      negativeArtifactKeys: [BOOKING_NEGATIVE],
      requiredEvidenceAnchors: [
        { artifactKey: 'api:booking.controller.cancel', contains: 'cancel' },
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
        'api:order.controller.cancelOrder',
        'service-method:order.service.cancelOrder',
      ],
      impactedArtifactKeys: [
        'api:order.controller.cancelOrder',
        'service-method:order.service.cancelOrder',
        'entity:order',
      ],
      negativeArtifactKeys: [
        'service-method:order.service.shipOrder',
        'api:order.controller.shipOrder',
      ],
      requiredEvidenceAnchors: [
        { artifactKey: 'api:order.controller.cancelOrder', contains: 'cancel' },
      ],
    },
    domain: { packId: 'ecommerce', expectedConceptKeys: ['order', 'cancellation'] },
  },
];
