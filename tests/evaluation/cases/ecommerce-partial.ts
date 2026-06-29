import { EvaluationCase } from '../evaluation-types';

export const ecommercePartialEvaluationCases: EvaluationCase[] = [
  {
    id: 'ecommerce-partial-order-cancel-inventory-release',
    requirementTitle: 'Cancel order before shipment and release inventory',
    requirementText:
      'When an ecommerce order is cancelled before shipment, release the inventory reservation and surface return/refund unknowns.',
    targetFixture: 'nestjs-order-inventory',
    expected: {
      impactedArtifactKeys: [
        'api:order.controller.cancelOrder',
        'service-method:order.service.cancelOrder',
        'service-method:inventory.service.releaseReservation',
        'entity:order',
        'entity:stockreservation',
      ],
      negativeArtifactKeys: ['service-method:discount.service.applyDiscountToOrder'],
      evidenceHints: ['cancelOrder', 'releaseReservation', 'CANCELLED'],
      unknownsOrQuestions: [
        'PARTIAL ecommerce unknown: whether cancellation should trigger return/refund behavior is not source-backed.',
      ],
      risks: [
        'PARTIAL ecommerce risk: order cancellation and inventory release may diverge without transaction evidence.',
      ],
      qaScenarios: [
        'PARTIAL ecommerce QA: cancel an order before shipment and verify source-backed order status and inventory reservation release.',
      ],
    },
    domain: {
      packId: 'ecommerce',
      expectedConceptKeys: ['order', 'shipment', 'inventory_reservation', 'return_refund'],
    },
  },
  {
    id: 'ecommerce-partial-checkout-inventory-reservation',
    requirementTitle: 'Reserve inventory during cart checkout',
    requirementText:
      'During cart checkout, reserve inventory for the order before payment intent capture.',
    targetFixture: 'nestjs-order-inventory',
    expected: {
      impactedArtifactKeys: [
        'service-method:inventory.service.reserveStock',
        'entity:stockreservation',
      ],
      negativeArtifactKeys: ['service-method:discount.service.applyDiscountToOrder'],
      evidenceHints: ['reserveStock', 'ReservationStatus.ACTIVE'],
      unknownsOrQuestions: [
        'PARTIAL ecommerce unknown: when inventory reservation should occur relative to payment intent is not source-backed.',
      ],
      risks: [
        'PARTIAL ecommerce risk: checkout may reserve inventory before payment intent or order state is settled.',
      ],
      qaScenarios: [
        'PARTIAL ecommerce QA: checkout a cart and verify source-backed inventory reservation behavior only.',
      ],
    },
    domain: {
      packId: 'ecommerce',
      expectedConceptKeys: [
        'order',
        'cart',
        'checkout',
        'payment_intent',
        'inventory_reservation',
      ],
    },
  },
  {
    id: 'ecommerce-partial-ship-order-consume-reservation',
    requirementTitle: 'Ship order and consume inventory reservation',
    requirementText:
      'When an order is shipped, consume the inventory reservation and update shipment workflow evidence.',
    targetFixture: 'nestjs-order-inventory',
    expected: {
      impactedArtifactKeys: [
        'api:order.controller.shipOrder',
        'service-method:order.service.shipOrder',
        'service-method:inventory.service.consumeReservation',
        'entity:order',
        'entity:stockreservation',
      ],
      negativeArtifactKeys: ['service-method:discount.service.applyDiscountToOrder'],
      evidenceHints: ['shipOrder', 'consumeReservation', 'SHIPPED'],
      unknownsOrQuestions: [
        'PARTIAL ecommerce unknown: downstream customer notification after shipment is not source-backed.',
      ],
      risks: [
        'PARTIAL ecommerce risk: shipment state may consume reservation without notification or cancellation boundary evidence.',
      ],
      qaScenarios: [
        'PARTIAL ecommerce QA: ship an order and verify source-backed reservation consumption and shipment boundary behavior.',
      ],
    },
    domain: {
      packId: 'ecommerce',
      expectedConceptKeys: ['order', 'shipment', 'inventory_reservation'],
    },
  },
];
